import os
import sys

# Bắt buộc cấu hình UTF-8 cho stdout/stderr để tránh lỗi UnicodeEncodeError trên các máy Windows dùng codepage cp1252/cp437
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Đảm bảo thư mục backend luôn nằm trong sys.path dù chạy từ bất kỳ thư mục nào
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import secrets
import asyncio
import tempfile
import socket
import threading
import time
import json
import argparse
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import psutil

from activity_monitor import ActivityMonitor
from system_profiler import get_system_profile
from audio_pipeline import audio_pipeline, CACHE_DIR
from ai_engine_manager import ai_engine_manager

app = FastAPI(title="Adaptive Flow & Beat Engine API", version="2.1.0")

SESSION_TOKEN = secrets.token_hex(16)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

monitor = ActivityMonitor()

# Cơ chế Heartbeat & Watchdog diệt tiến trình ma (Parent-Child Suicide Watchdog)
WATCHDOG_ENABLED = os.environ.get("WATCHDOG_ENABLED", "0") == "1" or "--watchdog" in sys.argv
last_heartbeat_time = time.time()
has_connected_once = False

def start_watchdog_thread():
    global last_heartbeat_time, has_connected_once
    while True:
        time.sleep(2)
        if WATCHDOG_ENABLED and has_connected_once:
            if len(manager.active_connections) == 0:
                elapsed = time.time() - last_heartbeat_time
                if elapsed > 8.0:
                    print(f"[Watchdog] Lost frontend connection ({elapsed:.1f}s > 8s). Terminating backend process.")
                    os._exit(0)

watchdog_t = threading.Thread(target=start_watchdog_thread, daemon=True)
watchdog_t.start()

class YouTubeRequest(BaseModel):
    url: str

class AutoFatigueRequest(BaseModel):
    enabled: bool

class BurstRequest(BaseModel):
    duration_seconds: float = 15.0

class EngineModeRequest(BaseModel):
    mode: str  # "COLAB_BATCH" | "LOCAL"

class DriveDirRequest(BaseModel):
    path: str

class CreatePlaylistRequest(BaseModel):
    name: str
    track_ids: Optional[List[str]] = []

class UpdatePlaylistRequest(BaseModel):
    name: Optional[str] = None
    track_ids: Optional[List[str]] = None

class ReorderPlaylistRequest(BaseModel):
    track_ids: List[str]

class ActivePlaylistRequest(BaseModel):
    playlist_id: str

class UpdateTitleRequest(BaseModel):
    title: str

class BatchActionRequest(BaseModel):
    action: str  # "process_local" | "dispatch_colab"
    track_ids: Optional[List[str]] = None

class OpenFolderRequest(BaseModel):
    folder_type: str = "input_audio"  # "input_audio" | "sync_drive" | "cache_stems" | "processed_audio" | "output_stems"

@app.get("/api/auth/token")
def get_session_token():
    return {"token": SESSION_TOKEN}

@app.get("/api/system-profile")
def api_system_profile():
    return get_system_profile()

@app.get("/api/tracks")
def api_get_tracks():
    return audio_pipeline.get_tracks()

@app.post("/api/tracks/youtube")
def api_add_youtube(req: YouTubeRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="URL không hợp lệ")
    try:
        track = audio_pipeline.add_youtube_url(req.url)
        return track
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải YouTube: {str(e)}")

@app.delete("/api/tracks/{track_id}")
def api_delete_track(track_id: str):
    audio_pipeline.delete_track(track_id)
    return {"status": "success", "deleted_id": track_id}

@app.post("/api/tracks/upload")
async def api_upload_track(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không có tệp được chọn")

    ext = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        temp_path = tmp.name
        try:
            chunk_size = 1024 * 1024  # 1MB chunk
            while content := await file.read(chunk_size):
                tmp.write(content)
        except Exception as e:
            tmp.close()
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=500, detail=f"Lỗi ghi tệp tải lên: {str(e)}")

    try:
        track = audio_pipeline.add_local_audio_file(temp_path, file.filename)
        return track
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý tệp âm thanh: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.put("/api/tracks/{track_id}/title")
def api_update_track_title(track_id: str, req: UpdateTitleRequest):
    updated = audio_pipeline.update_track_title(track_id, req.title)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát hoặc tiêu đề không hợp lệ")
    return updated

# ==========================================
# PLAYLISTS API ENDPOINTS
# ==========================================

@app.get("/api/playlists")
def api_get_playlists():
    return audio_pipeline.get_playlists_data()

@app.post("/api/playlists")
def api_create_playlist(req: CreatePlaylistRequest):
    new_pl = audio_pipeline.create_playlist(req.name, req.track_ids)
    return {"status": "success", "playlist": new_pl}

@app.put("/api/playlists/{playlist_id}")
def api_update_playlist(playlist_id: str, req: UpdatePlaylistRequest):
    updated = audio_pipeline.update_playlist(playlist_id, req.name, req.track_ids)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy Playlist")
    return {"status": "success", "playlist": updated}

@app.delete("/api/playlists/{playlist_id}")
def api_delete_playlist(playlist_id: str):
    if playlist_id == "default":
        raise HTTPException(status_code=400, detail="Không thể xóa Thư viện chính")
    deleted = audio_pipeline.delete_playlist(playlist_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy Playlist")
    return {"status": "success", "deleted_id": playlist_id}

@app.post("/api/playlists/{playlist_id}/reorder")
def api_reorder_playlist(playlist_id: str, req: ReorderPlaylistRequest):
    reordered = audio_pipeline.reorder_playlist_tracks(playlist_id, req.track_ids)
    if not reordered:
        raise HTTPException(status_code=404, detail="Không tìm thấy Playlist")
    return {"status": "success", "playlist": reordered}

@app.post("/api/playlists/active")
def api_set_active_playlist(req: ActivePlaylistRequest):
    ok = audio_pipeline.set_active_playlist(req.playlist_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy Playlist")
    return {"status": "success", "active_playlist_id": req.playlist_id}

@app.get("/api/tracks/{track_id}/audio/{stem_type}")
def api_stream_audio(track_id: str, stem_type: str):
    track = audio_pipeline.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát")

    track_dir = os.path.join(CACHE_DIR, track_id)

    def get_audio_media_type(filepath: str) -> str:
        ext = os.path.splitext(filepath)[1].lower()
        if ext in [".m4a", ".aac", ".mp4"]:
            return "audio/mp4"
        elif ext in [".webm", ".opus", ".ogg"]:
            return "audio/webm"
        elif ext == ".wav":
            return "audio/wav"
        elif ext == ".flac":
            return "audio/flac"
        return "audio/mpeg"

    def find_original_file() -> Optional[str]:
        orig = track.get("original_path")
        if orig and os.path.exists(orig) and os.path.getsize(orig) > 0:
            return orig
        for candidate in ["original.mp3", "original.m4a", "original.webm", "original.opus", "original.wav", "original.flac"]:
            p = os.path.join(track_dir, candidate)
            if os.path.exists(p) and os.path.getsize(p) > 0:
                track["original_path"] = p
                return p
        if os.path.exists(track_dir):
            for f in os.listdir(track_dir):
                if f.startswith("original.") and not f.endswith(".part"):
                    p = os.path.join(track_dir, f)
                    if os.path.getsize(p) > 0:
                        track["original_path"] = p
                        return p
        return None

    audio_headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    # Nếu yêu cầu bài gốc
    if stem_type == "original":
        orig_file = find_original_file()
        if orig_file:
            return FileResponse(orig_file, media_type=get_audio_media_type(orig_file), headers=audio_headers)

    # Nếu yêu cầu 1 trong 4 stems: vocals, other, bass, drums
    stem_file = os.path.join(track_dir, f"{stem_type}.mp3")
    if os.path.exists(stem_file):
        return FileResponse(stem_file, media_type="audio/mpeg", headers=audio_headers)

    # Tương thích ngược: calm -> other.mp3, energy -> drums.mp3 (nếu có)
    if stem_type == "calm" and os.path.exists(os.path.join(track_dir, "other.mp3")):
        return FileResponse(os.path.join(track_dir, "other.mp3"), media_type="audio/mpeg", headers=audio_headers)

    # Fallback về bài gốc nếu stem chưa sẵn sàng
    orig_file = find_original_file()
    if orig_file:
        return FileResponse(orig_file, media_type=get_audio_media_type(orig_file), headers=audio_headers)

    raise HTTPException(status_code=404, detail=f"File audio {stem_type} chưa sẵn sàng")

@app.get("/api/system/demucs-status")
def api_demucs_status():
    return ai_engine_manager.get_status()

@app.post("/api/system/install-demucs")
def api_install_demucs():
    return ai_engine_manager.start_install()

@app.post("/api/tracks/{track_id}/process-local")
def api_process_track_local(track_id: str):
    res = audio_pipeline.process_track_local(track_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/tracks/{track_id}/dispatch-colab")
def api_dispatch_track_colab(track_id: str):
    res = audio_pipeline.dispatch_track_to_colab(track_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/tracks/batch-action")
def api_batch_action(req: BatchActionRequest):
    return audio_pipeline.batch_action(req.action, req.track_ids)

@app.post("/api/system/open-folder")
def api_open_folder(req: OpenFolderRequest):
    folder_path = None
    if req.folder_type == "input_audio":
        folder_path = os.path.join(audio_pipeline.drive_sync_dir, "01_Input_Audio")
    elif req.folder_type == "processed_audio":
        folder_path = os.path.join(audio_pipeline.drive_sync_dir, "02_Processed_Audio")
    elif req.folder_type == "output_stems":
        folder_path = os.path.join(audio_pipeline.drive_sync_dir, "03_Output_Stems")
    elif req.folder_type == "sync_drive":
        folder_path = audio_pipeline.drive_sync_dir
    elif req.folder_type == "cache_stems":
        folder_path = CACHE_DIR
    else:
        folder_path = audio_pipeline.drive_sync_dir

    os.makedirs(folder_path, exist_ok=True)
    try:
        if sys.platform == "win32":
            os.startfile(folder_path)
        elif sys.platform == "darwin":
            subprocess.run(["open", folder_path])
        else:
            subprocess.run(["xdg-open", folder_path])
        return {"status": "ok", "path": folder_path}
    except Exception as e:
        return {"status": "error", "message": str(e), "path": folder_path}

@app.post("/api/tracks/import-stems-zip")
async def api_import_stems_zip(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không có file nào được chọn")
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Vui lòng chỉ nạp định dạng file .zip")

    try:
        content = await file.read()
        res = audio_pipeline.import_stems_from_zip(content)
        if not res.get("success"):
            raise HTTPException(status_code=400, detail=res.get("message", "Lỗi nạp file zip"))
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý file zip: {str(e)}")

@app.post("/api/settings/engine-mode")
def api_set_engine_mode(req: EngineModeRequest):
    audio_pipeline.set_engine_mode(req.mode)
    return {"status": "success", "engine_mode": audio_pipeline.engine_mode}

@app.post("/api/settings/drive-dir")
def api_set_drive_dir(req: DriveDirRequest):
    audio_pipeline.set_drive_sync_dir(req.path)
    return {"status": "success", "drive_sync_dir": audio_pipeline.drive_sync_dir}

@app.post("/api/sync/check-drive")
def api_force_sync_drive():
    synced = audio_pipeline.sync_from_drive()
    return {
        "status": "success",
        "synced_count": synced,
        "pending_colab_count": audio_pipeline.get_pending_colab_count(),
        "tracks": audio_pipeline.get_tracks()
    }

@app.post("/api/controls/burst")
def api_trigger_burst(req: BurstRequest):
    monitor.trigger_manual_burst(req.duration_seconds)
    return {"status": "success", "state": monitor.current_state}

@app.post("/api/controls/burst-cancel")
def api_cancel_burst():
    monitor.cancel_manual_burst()
    return {"status": "success", "state": monitor.current_state}

@app.post("/api/controls/auto-fatigue")
def api_set_auto_fatigue(req: AutoFatigueRequest):
    monitor.set_auto_fatigue(req.enabled)
    return {"status": "success", "auto_fatigue_enabled": req.enabled}

@app.post("/api/controls/pomodoro-reset")
def api_reset_pomodoro():
    monitor.reset_pomodoro()
    return {"status": "success", "message": "Pomodoro reset"}

@app.post("/api/system/heartbeat")
def api_heartbeat():
    global last_heartbeat_time, has_connected_once
    last_heartbeat_time = time.time()
    has_connected_once = True
    return {"status": "ok", "timestamp": last_heartbeat_time}

@app.post("/api/system/shutdown")
def api_shutdown():
    def delayed_exit():
        time.sleep(0.3)
        print("[System] Received shutdown signal from Desktop Master. Exiting Python.")
        os._exit(0)
    threading.Thread(target=delayed_exit, daemon=True).start()
    return {"status": "shutting_down"}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    global last_heartbeat_time, has_connected_once
    if token != SESSION_TOKEN:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    has_connected_once = True
    last_heartbeat_time = time.time()

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                last_heartbeat_time = time.time()
                if data.get("action") == "BURST":
                    monitor.trigger_manual_burst(data.get("duration", 15.0))
                elif data.get("action") == "RESET_BURST":
                    monitor.cancel_manual_burst()
                elif data.get("action") == "PING":
                    # Nhịp tim kiểm tra sự sống (Heartbeat ping)
                    pass
            except asyncio.TimeoutError:
                pass

            state_data = monitor.tick()
            sys_mem = psutil.virtual_memory()

            payload = {
                "activity": state_data,
                "system": {
                    "cpu_percent": psutil.cpu_percent(),
                    "ram_used_mb": int((sys_mem.total - sys_mem.available) / (1024 ** 2)),
                    "ram_percent": sys_mem.percent
                },
                "queue": audio_pipeline.get_queue_status(),
                "tracks_count": len(audio_pipeline.tracks)
            }
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

def find_free_port(start_port: int = 8000, max_attempts: int = 50) -> int:
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return start_port

if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=None, help="Port to run backend")
    parser.add_argument("--watchdog", action="store_true", help="Enable suicide watchdog")
    args, unknown = parser.parse_known_args()

    port = args.port or int(os.environ.get("BACKEND_PORT", 0)) or find_free_port(8000)
    if args.watchdog:
        WATCHDOG_ENABLED = True

    # Lưu thông tin port đang chạy để Desktop / Frontend đọc
    port_info = {
        "port": port,
        "token": SESSION_TOKEN,
        "pid": os.getpid(),
        "created_at": time.time()
    }
    base_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
    port_file = os.path.join(base_dir, "active_port.json")
    try:
        with open(port_file, "w", encoding="utf-8") as pf:
            json.dump(port_info, pf, indent=2)
    except Exception as e:
        print(f"[Port] Loi ghi active_port.json: {e}")

    print(f"[Backend Engine] Khoi dong tai http://127.0.0.1:{port} (Session Token: {SESSION_TOKEN}, Watchdog: {WATCHDOG_ENABLED})")
    uvicorn.run(app, host="127.0.0.1", port=port)
