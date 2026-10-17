import os
import secrets
import asyncio
from typing import Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import psutil

from activity_monitor import ActivityMonitor
from system_profiler import get_system_profile
from audio_pipeline import audio_pipeline, CACHE_DIR

app = FastAPI(title="Adaptive Flow & Beat Engine API", version="2.1.0")

SESSION_TOKEN = secrets.token_hex(16)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

monitor = ActivityMonitor()

class YouTubeRequest(BaseModel):
    url: str

class AutoFatigueRequest(BaseModel):
    enabled: bool

class BurstRequest(BaseModel):
    duration_seconds: float = 30.0

class EngineModeRequest(BaseModel):
    mode: str  # "COLAB_BATCH" | "LOCAL"

class DriveDirRequest(BaseModel):
    path: str

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

@app.get("/api/tracks/{track_id}/audio/{stem_type}")
def api_stream_audio(track_id: str, stem_type: str):
    track = audio_pipeline.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát")

    track_dir = os.path.join(CACHE_DIR, track_id)

    # Nếu yêu cầu bài gốc
    if stem_type == "original":
        orig_file = track.get("original_path") or os.path.join(track_dir, "original.mp3")
        if os.path.exists(orig_file):
            return FileResponse(orig_file, media_type="audio/mpeg")

    # Nếu yêu cầu 1 trong 4 stems: vocals, other, bass, drums
    stem_file = os.path.join(track_dir, f"{stem_type}.mp3")
    if os.path.exists(stem_file):
        return FileResponse(stem_file, media_type="audio/mpeg")

    # Tương thích ngược: calm -> other.mp3, energy -> drums.mp3 (nếu có)
    if stem_type == "calm" and os.path.exists(os.path.join(track_dir, "other.mp3")):
        return FileResponse(os.path.join(track_dir, "other.mp3"), media_type="audio/mpeg")

    # Fallback về bài gốc nếu stem chưa sẵn sàng
    orig_file = track.get("original_path") or os.path.join(track_dir, "original.mp3")
    if os.path.exists(orig_file):
        return FileResponse(orig_file, media_type="audio/mpeg")

    raise HTTPException(status_code=404, detail=f"File audio {stem_type} chưa sẵn sàng")

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

@app.post("/api/controls/auto-fatigue")
def api_set_auto_fatigue(req: AutoFatigueRequest):
    monitor.set_auto_fatigue(req.enabled)
    return {"status": "success", "auto_fatigue_enabled": req.enabled}

@app.post("/api/controls/pomodoro-reset")
def api_reset_pomodoro():
    monitor.reset_pomodoro()
    return {"status": "success", "message": "Pomodoro reset"}

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
    if token != SESSION_TOKEN:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                if data.get("action") == "BURST":
                    monitor.trigger_manual_burst(data.get("duration", 30.0))
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

if __name__ == "__main__":
    import uvicorn
    print(f"Khởi động Backend tại http://127.0.0.1:8000 (Session Token: {SESSION_TOKEN})")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
