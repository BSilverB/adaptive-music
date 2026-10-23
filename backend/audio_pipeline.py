import os
import sys
import time
import json
import glob
import queue
import shutil
import threading
import subprocess
import urllib.request
import hashlib
from typing import Dict, Any, List, Optional, Tuple
import yt_dlp
from pydub import AudioSegment
from ai_engine_manager import ai_engine_manager

if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CACHE_DIR = os.path.join(BASE_DIR, "cache_stems")
TRACKS_FILE = os.path.join(CACHE_DIR, "tracks.json")
PLAYLISTS_FILE = os.path.join(CACHE_DIR, "playlists.json")
DELETED_TRACKS_FILE = os.path.join(CACHE_DIR, "deleted_tracks.json")

try:
    os.makedirs(CACHE_DIR, exist_ok=True)
except Exception as e:
    print(f"[Cache] Failed to create CACHE_DIR: {e}")

def fetch_real_track_info(video_id: str, audio_path: Optional[str] = None) -> Tuple[str, int]:
    """
    Lấy tiêu đề chính thức từ YouTube qua oEmbed API và đo thời lượng chính xác từ file audio.
    """
    title = f"Track {video_id}"
    duration = 0

    try:
        req = urllib.request.Request(
            f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            if data.get("title"):
                title = data["title"]
    except Exception:
        pass

    if audio_path and os.path.exists(audio_path):
        try:
            seg = AudioSegment.from_file(audio_path)
            duration = int(len(seg) / 1000)
        except Exception:
            pass

    return title, duration

def extract_audio_metadata(file_path: str, fallback_title: str = "Unknown Track") -> Tuple[str, int]:
    """
    Đọc siêu dữ liệu (Title, Artist, Duration) từ file âm thanh qua ffprobe chuẩn xác và siêu nhẹ (< 15ms).
    """
    title = fallback_title
    duration = 0
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            file_path
        ]
        creationflags = 0x00004000 if sys.platform == "win32" else 0
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=creationflags)
        if res.returncode == 0:
            data = json.loads(res.stdout)
            fmt = data.get("format", {})
            if "duration" in fmt:
                try:
                    duration = int(float(fmt["duration"]))
                except Exception:
                    pass
            tags = fmt.get("tags", {})
            tag_title = tags.get("title") or tags.get("TITLE") or tags.get("Title")
            tag_artist = tags.get("artist") or tags.get("ARTIST") or tags.get("Artist")
            if tag_title:
                if tag_artist and tag_artist.lower() not in tag_title.lower():
                    title = f"{tag_artist} - {tag_title}"
                else:
                    title = tag_title
    except Exception as e:
        print(f"[Metadata] Error reading ffprobe metadata: {e}")

    if duration == 0 and os.path.exists(file_path):
        try:
            seg = AudioSegment.from_file(file_path)
            duration = int(len(seg) / 1000)
        except Exception:
            pass

    return title, duration

def is_cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except Exception:
        return False

class AudioPipeline:
    """
    Quản lý tải nhạc (yt-dlp đơn bài lẫn cả Playlist) và điều phối 2 chế độ xử lý:
    1. COLAB_BATCH (Mặc định cho máy không GPU): Đẩy file vào Google Drive 01_Input_Audio/, chờ Colab tách
    2. LOCAL: Chạy Demucs trực tiếp trên máy
    """

    def __init__(self):
        self.device = "cuda" if is_cuda_available() else "cpu"
        self.engine_mode = "COLAB_BATCH" if self.device == "cpu" else "LOCAL"
        
        self.drive_sync_dir = self._detect_drive_sync_dir()
        self._ensure_drive_folders()

        self.deleted_tracks: set = self._load_deleted_tracks()
        self.tracks: Dict[str, Dict[str, Any]] = self._load_tracks()
        self.tracks_version: float = time.time()
        self.clean_legacy_stems()
        self.cleanup_completed_from_drive_input()
        self.playlists_data: Dict[str, Any] = self._load_playlists()
        self._sync_default_playlist()

        # Hàng đợi tải bài từ YouTube (Download Queue)
        self.download_queue: queue.Queue = queue.Queue()
        self.current_download: Optional[str] = None
        self.download_thread = threading.Thread(target=self._download_worker_loop, daemon=True)
        self.download_thread.start()

        # Hàng đợi tách nhạc Local Demucs
        self.job_queue: queue.Queue = queue.Queue()
        self.current_job: Optional[str] = None
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()

        # Quét ban đầu từ Drive
        self.sync_from_drive()

        # Thread quét định kỳ thư mục Drive mỗi 20 giây
        self.drive_watcher = threading.Thread(target=self._drive_watcher_loop, daemon=True)
        self.drive_watcher.start()

    def _detect_drive_sync_dir(self) -> str:
        candidates = [
            r"G:\My Drive\AdaptiveMusic_Sync",
            r"G:\Drive của tôi\AdaptiveMusic_Sync",
            os.path.expanduser(r"~\Google Drive\AdaptiveMusic_Sync"),
            os.path.join(BASE_DIR, "sync_drive", "AdaptiveMusic_Sync"),
        ]
        for path in candidates:
            if os.path.exists(os.path.dirname(path)):
                return path
        return os.path.join(BASE_DIR, "sync_drive", "AdaptiveMusic_Sync")

    def _ensure_drive_folders(self) -> None:
        try:
            for sub in ["01_Input_Audio", "02_Processed_Audio", "03_Output_Stems"]:
                os.makedirs(os.path.join(self.drive_sync_dir, sub), exist_ok=True)
        except Exception as e:
            print(f"[Drive Sync] Failed to create sync directory: {e}")

    def _cleanup_drive_input(self, track_id: str) -> None:
        """Xóa file nhạc khỏi 01_Input_Audio trên Drive nếu bài này đã được tách stems xong ở local."""
        if self.drive_sync_dir and os.path.exists(self.drive_sync_dir):
            input_dir = os.path.join(self.drive_sync_dir, "01_Input_Audio")
            if os.path.exists(input_dir):
                for ext in [".mp3", ".wav"]:
                    target = os.path.join(input_dir, f"{track_id}{ext}")
                    if os.path.exists(target):
                        try:
                            os.remove(target)
                            print(f"[Drive Cleanup] Removed {track_id}{ext} from 01_Input_Audio (already completed locally)")
                        except Exception as e:
                            print(f"[Drive Cleanup] Error removing {target}: {e}")

    def cleanup_completed_from_drive_input(self) -> None:
        """Quét và dọn dẹp toàn bộ file trong 01_Input_Audio nếu các bài đó đã có 4 stems sẵn sàng."""
        for tid, trk in self.tracks.items():
            if trk.get("has_stems"):
                self._cleanup_drive_input(tid)

    def set_drive_sync_dir(self, new_path: str) -> None:
        if new_path and os.path.exists(os.path.dirname(new_path)):
            self.drive_sync_dir = new_path
            self._ensure_drive_folders()
            self.sync_from_drive()

    def set_engine_mode(self, mode: str) -> None:
        if mode in ["COLAB_BATCH", "LOCAL"]:
            self.engine_mode = mode

    def _load_deleted_tracks(self) -> set:
        if os.path.exists(DELETED_TRACKS_FILE):
            try:
                with open(DELETED_TRACKS_FILE, "r", encoding="utf-8") as f:
                    return set(json.load(f))
            except Exception:
                pass
        return set()

    def _save_deleted_tracks(self) -> None:
        try:
            with open(DELETED_TRACKS_FILE, "w", encoding="utf-8") as f:
                json.dump(list(self.deleted_tracks), f, indent=2)
        except Exception:
            pass

    def _load_tracks(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(TRACKS_FILE):
            try:
                with open(TRACKS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_tracks(self) -> None:
        self.tracks_version = time.time()
        try:
            with open(TRACKS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.tracks, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[AudioPipeline] Error saving tracks.json: {e}")

    def get_tracks(self) -> List[Dict[str, Any]]:
        return list(self.tracks.values())

    def get_track(self, track_id: str) -> Optional[Dict[str, Any]]:
        return self.tracks.get(track_id)

    def delete_track(self, track_id: str) -> bool:
        """Xóa bài hát khỏi danh sách và ghi nhớ để không bị Drive sync lại"""
        deleted = False
        if track_id in self.tracks:
            del self.tracks[track_id]
            deleted = True

        self.deleted_tracks.add(track_id)
        self._save_deleted_tracks()
        self._save_tracks()

        # Dọn dẹp thư mục cache local
        track_dir = os.path.join(CACHE_DIR, track_id)
        if os.path.exists(track_dir):
            try:
                shutil.rmtree(track_dir, ignore_errors=True)
            except Exception:
                pass

        # Dọn dẹp đồng bộ trên Google Drive (01_Input, 02_Processed, 03_Output)
        if self.drive_sync_dir and os.path.exists(self.drive_sync_dir):
            drive_cleanups = [
                (os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{track_id}.mp3"), False),
                (os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{track_id}.wav"), False),
                (os.path.join(self.drive_sync_dir, "02_Processed_Audio", f"{track_id}.mp3"), False),
                (os.path.join(self.drive_sync_dir, "02_Processed_Audio", f"{track_id}.wav"), False),
                (os.path.join(self.drive_sync_dir, "03_Output_Stems", track_id), True),
            ]
            for target_path, is_dir in drive_cleanups:
                if os.path.exists(target_path):
                    try:
                        if is_dir:
                            shutil.rmtree(target_path, ignore_errors=True)
                        else:
                            os.remove(target_path)
                    except Exception as e:
                        print(f"[Drive Cleanup] Failed to remove {target_path}: {e}")

        if deleted:
            self._sync_default_playlist()

        return deleted

    # ==========================================
    # QUẢN LÝ DANH SÁCH PHÁT (PLAYLISTS MANAGER)
    # ==========================================

    def _load_playlists(self) -> Dict[str, Any]:
        default_structure = {
            "playlists": {
                "default": {
                    "id": "default",
                    "name": "Thư viện chính",
                    "track_ids": [],
                    "is_default": True,
                    "created_at": time.time()
                }
            },
            "active_playlist_id": "default"
        }
        if os.path.exists(PLAYLISTS_FILE):
            try:
                with open(PLAYLISTS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "playlists" in data and "default" in data["playlists"]:
                        return data
            except Exception:
                pass
        return default_structure

    def _save_playlists(self) -> None:
        try:
            with open(PLAYLISTS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.playlists_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[AudioPipeline] Error saving playlists.json: {e}")

    def _sync_default_playlist(self) -> None:
        """Đồng bộ đảm bảo toàn bộ bài trong self.tracks có mặt trong default playlist và loại bỏ bài đã xóa."""
        all_track_ids = set(self.tracks.keys())
        playlists = self.playlists_data.get("playlists", {})
        default_pl = playlists.get("default")
        if not default_pl:
            default_pl = {
                "id": "default",
                "name": "Thư viện chính",
                "track_ids": [],
                "is_default": True,
                "created_at": time.time()
            }
            playlists["default"] = default_pl

        # Giữ nguyên thứ tự bài cũ, loại bỏ bài không còn tồn tại
        existing_ordered = [tid for tid in default_pl.get("track_ids", []) if tid in all_track_ids]
        existing_set = set(existing_ordered)

        # Bổ sung các bài mới chưa có vào cuối danh sách
        for tid in self.tracks.keys():
            if tid not in existing_set:
                existing_ordered.append(tid)

        default_pl["track_ids"] = existing_ordered

        # Dọn dẹp bài đã xóa khỏi các custom playlists
        for pl_id, pl in playlists.items():
            if pl_id != "default":
                pl["track_ids"] = [tid for tid in pl.get("track_ids", []) if tid in all_track_ids]

        self._save_playlists()

    def get_playlists_data(self) -> Dict[str, Any]:
        self._sync_default_playlist()
        return self.playlists_data

    def create_playlist(self, name: str, track_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        playlist_id = f"pl_{int(time.time() * 1000)}"
        valid_ids = [tid for tid in (track_ids or []) if tid in self.tracks]
        new_pl = {
            "id": playlist_id,
            "name": name.strip() or f"Playlist {len(self.playlists_data['playlists'])}",
            "track_ids": valid_ids,
            "is_default": False,
            "created_at": time.time()
        }
        self.playlists_data["playlists"][playlist_id] = new_pl
        self._save_playlists()
        return new_pl

    def update_playlist(self, playlist_id: str, name: Optional[str] = None, track_ids: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
        pl = self.playlists_data["playlists"].get(playlist_id)
        if not pl:
            return None
        if name is not None and name.strip() and not pl.get("is_default", False):
            pl["name"] = name.strip()
        if track_ids is not None:
            pl["track_ids"] = [tid for tid in track_ids if tid in self.tracks]
        self._save_playlists()
        return pl

    def delete_playlist(self, playlist_id: str) -> bool:
        if playlist_id == "default" or playlist_id not in self.playlists_data["playlists"]:
            return False
        del self.playlists_data["playlists"][playlist_id]
        if self.playlists_data.get("active_playlist_id") == playlist_id:
            self.playlists_data["active_playlist_id"] = "default"
        self._save_playlists()
        return True

    def reorder_playlist_tracks(self, playlist_id: str, track_ids: List[str]) -> Optional[Dict[str, Any]]:
        pl = self.playlists_data["playlists"].get(playlist_id)
        if not pl:
            return None
        valid_ids = [tid for tid in track_ids if tid in self.tracks]
        pl["track_ids"] = valid_ids
        self._save_playlists()
        return pl

    def set_active_playlist(self, playlist_id: str) -> bool:
        if playlist_id in self.playlists_data["playlists"]:
            self.playlists_data["active_playlist_id"] = playlist_id
            self._save_playlists()
            return True
        return False

    def clean_legacy_stems(self) -> None:
        """Dọn dẹp các file calm_stem.mp3 và energy_stem.mp3 cũ để chuyển hoàn toàn sang 4 stems."""
        cleaned = 0
        for video_id, track in list(self.tracks.items()):
            track_dir = os.path.join(CACHE_DIR, video_id)
            if not os.path.exists(track_dir):
                continue

            for legacy in ["calm_stem.mp3", "energy_stem.mp3"]:
                legacy_file = os.path.join(track_dir, legacy)
                if os.path.exists(legacy_file):
                    try:
                        os.remove(legacy_file)
                        cleaned += 1
                    except Exception:
                        pass

            has_4_stems = all(
                os.path.exists(os.path.join(track_dir, f"{s}.mp3")) and os.path.getsize(os.path.join(track_dir, f"{s}.mp3")) > 0
                for s in ["vocals", "other", "bass", "drums"]
            )
            track["has_stems"] = has_4_stems
            track.pop("calm_path", None)
            track.pop("energy_path", None)
            if not has_4_stems:
                track["status"] = "WAITING_COLAB" if self.engine_mode == "COLAB_BATCH" else "QUEUED"
                original_mp3 = os.path.join(track_dir, "original.mp3")
                if os.path.exists(original_mp3) and self.engine_mode == "COLAB_BATCH":
                    input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{video_id}.mp3")
                    if not os.path.exists(input_drive_file):
                        try:
                            shutil.copy2(original_mp3, input_drive_file)
                        except Exception:
                            pass

        self._save_tracks()
        if cleaned > 0:
            print(f"[AudioPipeline] Cleaned {cleaned} legacy stems. Switched to 4-stems mode.")

    def get_pending_colab_count(self) -> int:
        input_dir = os.path.join(self.drive_sync_dir, "01_Input_Audio")
        if not os.path.exists(input_dir):
            return 0
        return len(glob.glob(os.path.join(input_dir, "*.mp3"))) + len(glob.glob(os.path.join(input_dir, "*.wav")))

    def sync_from_drive(self) -> int:
        output_dir = os.path.join(self.drive_sync_dir, "03_Output_Stems")
        if not os.path.exists(output_dir):
            return 0

        synced_count = 0
        for video_id in os.listdir(output_dir):
            if video_id in self.deleted_tracks:
                continue

            stem_dir = os.path.join(output_dir, video_id)
            if not os.path.isdir(stem_dir):
                continue

            vocals_drive = os.path.join(stem_dir, "vocals.mp3")
            other_drive = os.path.join(stem_dir, "other.mp3")
            bass_drive = os.path.join(stem_dir, "bass.mp3")
            drums_drive = os.path.join(stem_dir, "drums.mp3")
            meta_file = os.path.join(stem_dir, "metadata.json")

            has_all_drive_stems = (
                os.path.exists(vocals_drive) and os.path.exists(other_drive) and
                os.path.exists(bass_drive) and os.path.exists(drums_drive)
            )

            if has_all_drive_stems:
                local_track_dir = os.path.join(CACHE_DIR, video_id)
                os.makedirs(local_track_dir, exist_ok=True)

                try:
                    for s in ["vocals", "other", "bass", "drums"]:
                        src = os.path.join(stem_dir, f"{s}.mp3")
                        dst = os.path.join(local_track_dir, f"{s}.mp3")
                        if not os.path.exists(dst) or os.path.getsize(dst) == 0:
                            shutil.copy2(src, dst)
                except Exception as e:
                    print(f"[Drive Sync] Error copying 4 stems for {video_id}: {e}")

                meta_data = {}
                if os.path.exists(meta_file):
                    try:
                        with open(meta_file, "r", encoding="utf-8") as mf:
                            meta_data = json.load(mf)
                    except Exception:
                        pass

                local_other = os.path.join(local_track_dir, "other.mp3")
                if video_id in self.tracks:
                    track = self.tracks[video_id]
                    if not track.get("has_stems"):
                        track["status"] = "READY"
                        track["has_stems"] = True
                        track["bpm"] = meta_data.get("bpm")
                        if track.get("duration", 0) == 0 and os.path.exists(local_other):
                            try:
                                track["duration"] = int(len(AudioSegment.from_file(local_other)) / 1000)
                            except Exception:
                                pass
                        synced_count += 1
                else:
                    real_title, duration = fetch_real_track_info(video_id, local_other)
                    self.tracks[video_id] = {
                        "id": video_id,
                        "title": meta_data.get("title") or real_title,
                        "duration": meta_data.get("duration") or duration,
                        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg",
                        "status": "READY",
                        "has_stems": True,
                        "bpm": meta_data.get("bpm"),
                        "original_path": os.path.join(local_track_dir, "original.mp3"),
                    }
                    synced_count += 1

        if synced_count > 0:
            self._save_tracks()
            self._sync_default_playlist()
            print(f"[Drive Sync] Successfully synced {synced_count} tracks from Colab 4 Stems!")

        return synced_count

    def _drive_watcher_loop(self):
        import time
        while True:
            time.sleep(20)
            try:
                self.sync_from_drive()
            except Exception:
                pass

    def add_local_audio_file(self, temp_path: str, original_filename: str) -> Dict[str, Any]:
        """
        Xử lý nạp file âm thanh cục bộ (BYOA: Bring Your Own Audio):
        - Băm mã SHA-256 tạo định danh loc_{hash[:12]}
        - Kiểm tra Cache Hit nếu bài này đã từng nạp hoặc đã tách stems
        - Chuyển đổi / Chuẩn hóa sang original.mp3 (192kbps)
        - Trích xuất Title / Artist / Duration qua ffprobe siêu nhẹ
        - Nếu mode COLAB_BATCH: copy vào 01_Input_Audio/ trên Drive
        - Nếu mode LOCAL: nạp vào job_queue của Demucs
        """
        hasher = hashlib.sha256()
        with open(temp_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        track_hash = hasher.hexdigest()[:12]
        track_id = f"loc_{track_hash}"

        # Bỏ blacklist nếu từng xóa bài này
        if track_id in self.deleted_tracks:
            self.deleted_tracks.remove(track_id)
            self._save_deleted_tracks()

        track_dir = os.path.join(CACHE_DIR, track_id)
        os.makedirs(track_dir, exist_ok=True)
        original_mp3 = os.path.join(track_dir, "original.mp3")

        # Kiểm tra Cache Hit cho 4 Stems
        has_stems = all(
            os.path.exists(os.path.join(track_dir, f"{s}.mp3")) and os.path.getsize(os.path.join(track_dir, f"{s}.mp3")) > 0
            for s in ["vocals", "other", "bass", "drums"]
        )
        cache_hit = has_stems

        # Tên gốc bỏ phần mở rộng làm fallback title
        base_name, _ = os.path.splitext(original_filename)
        fallback_title = base_name.strip() if base_name.strip() else f"Local Track {track_hash}"

        # Chuyển đổi sang original.mp3 nếu chưa tồn tại
        if not os.path.exists(original_mp3) or os.path.getsize(original_mp3) == 0:
            cmd = [
                "ffmpeg", "-y", "-i", temp_path,
                "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k",
                original_mp3
            ]
            creationflags = 0x00004000 if sys.platform == "win32" else 0
            conv_res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=creationflags)
            if conv_res.returncode != 0:
                if temp_path.lower().endswith(".mp3"):
                    shutil.copy2(temp_path, original_mp3)
                else:
                    raise RuntimeError(f"FFmpeg chuyển đổi thất bại: {conv_res.stderr.decode('utf-8', errors='ignore')[-300:]}")

        # Đọc metadata qua ffprobe
        title, duration = extract_audio_metadata(original_mp3, fallback_title)

        status = "READY" if has_stems else ("WAITING_COLAB" if self.engine_mode == "COLAB_BATCH" else "QUEUED")
        track_data = {
            "id": track_id,
            "title": title,
            "duration": duration,
            "thumbnail": "",
            "status": status,
            "has_stems": has_stems,
            "original_path": original_mp3,
            "source": "local",
            "cache_hit": cache_hit
        }

        self.tracks[track_id] = track_data

        # Đồng bộ sang Colab hoặc Local Demucs nếu chưa có stems
        if not has_stems:
            if self.engine_mode == "COLAB_BATCH":
                input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{track_id}.mp3")
                if not os.path.exists(input_drive_file):
                    try:
                        shutil.copy2(original_mp3, input_drive_file)
                        print(f"[Colab Batch] Uploaded local file {track_id}.mp3 to 01_Input_Audio/")
                    except Exception as e:
                        print(f"[Colab Batch] Failed to upload local file to Drive: {e}")
            else:
                self.job_queue.put(track_id)

        self._save_tracks()
        self._sync_default_playlist()
        print(f"[AudioPipeline] Local file loaded successfully: {track_id} - Cache Hit: {cache_hit}")

        return track_data

    def update_track_title(self, track_id: str, new_title: str) -> Optional[Dict[str, Any]]:
        clean_title = new_title.strip()
        if not clean_title or track_id not in self.tracks:
            return None
        self.tracks[track_id]["title"] = clean_title
        self._save_tracks()
        return self.tracks[track_id]

    def add_youtube_url(self, url: str) -> Dict[str, Any]:
        """
        Nhận URL YouTube: Hỗ trợ CẢ BÀI ĐƠN LẪN TOÀN BỘ PLAYLIST.
        """
        ydl_flat_opts = {
            "extract_flat": "in_playlist",
            "quiet": True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(ydl_flat_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        is_playlist = info.get("_type") == "playlist" or "entries" in info
        entries = []

        if is_playlist:
            raw_entries = list(info.get("entries", []))
            playlist_title = info.get("title", "YouTube Playlist")
            print(f"[AudioPipeline] Detected Playlist: '{playlist_title}' ({len(raw_entries)} items)")
            for item in raw_entries:
                if item and item.get("id"):
                    entries.append({
                        "id": item.get("id"),
                        "title": item.get("title", f"Track {item.get('id')}"),
                        "duration": item.get("duration", 0),
                        "thumbnail": item.get("thumbnail", "")
                    })
        else:
            entries.append({
                "id": info.get("id"),
                "title": info.get("title", "Unknown Title"),
                "duration": info.get("duration", 0),
                "thumbnail": info.get("thumbnail", "")
            })

        added_tracks = []
        for entry in entries:
            video_id = entry["id"]

            # Nếu bài này từng bị xóa thì gỡ khỏi danh sách blacklist
            if video_id in self.deleted_tracks:
                self.deleted_tracks.remove(video_id)
                self._save_deleted_tracks()

            track_dir = os.path.join(CACHE_DIR, video_id)
            original_mp3 = os.path.join(track_dir, "original.mp3")

            has_stems = all(
                os.path.exists(os.path.join(track_dir, f"{s}.mp3")) and os.path.getsize(os.path.join(track_dir, f"{s}.mp3")) > 0
                for s in ["vocals", "other", "bass", "drums"]
            )
            has_original = os.path.exists(original_mp3)

            # Lấy tiêu đề chính xác nếu entry title bị thiếu hoặc là placeholder
            title = entry["title"]
            if title.startswith("Track ") or not title:
                real_title, _ = fetch_real_track_info(video_id, None)
                if not real_title.startswith("Track "):
                    title = real_title

            track_data = {
                "id": video_id,
                "title": title,
                "duration": entry["duration"],
                "thumbnail": entry["thumbnail"],
                "status": "READY" if has_stems else ("WAITING_COLAB" if self.engine_mode == "COLAB_BATCH" else "QUEUED"),
                "has_stems": has_stems,
                "original_path": original_mp3,
            }

            self.tracks[video_id] = track_data
            added_tracks.append(track_data)

            if not has_original:
                self.download_queue.put(entry)
            else:
                if not has_stems and self.engine_mode == "COLAB_BATCH":
                    input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{video_id}.mp3")
                    if not os.path.exists(input_drive_file):
                        try:
                            shutil.copy2(original_mp3, input_drive_file)
                        except Exception:
                            pass

        self._save_tracks()
        self._sync_default_playlist()

        return {
            "is_playlist": is_playlist,
            "total_items": len(added_tracks),
            "tracks": added_tracks
        }

    def _download_worker_loop(self):
        while True:
            entry = self.download_queue.get()
            video_id = entry["id"]
            self.current_download = video_id
            print(f"[Download Worker] Downloading audio for: {video_id}...")

            track_dir = os.path.join(CACHE_DIR, video_id)
            os.makedirs(track_dir, exist_ok=True)

            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": os.path.join(track_dir, "original.%(ext)s"),
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
                "quiet": True,
                "no_warnings": True,
            }

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)

                original_mp3 = os.path.join(track_dir, "original.mp3")
                print(f"[Download Worker] Successfully downloaded: {video_id}")

                track = self.tracks.get(video_id)
                if track:
                    track["original_path"] = original_mp3
                    if info.get("title"):
                        track["title"] = info["title"]
                    if info.get("duration"):
                        track["duration"] = info["duration"]

                    if self.engine_mode == "COLAB_BATCH":
                        input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{video_id}.mp3")
                        try:
                            shutil.copy2(original_mp3, input_drive_file)
                            print(f"[Colab Batch] Pushed {video_id}.mp3 to 01_Input_Audio/ on Drive")
                        except Exception as e:
                            print(f"[Colab Batch] Failed to push file to Drive: {e}")
                        track["status"] = "WAITING_COLAB"
                    else:
                        track["status"] = "QUEUED"
                        self.job_queue.put(video_id)

                    self._save_tracks()
            except Exception as e:
                print(f"[Download Worker] Download error for {video_id}: {e}")
            finally:
                self.current_download = None
                self.download_queue.task_done()

    def _worker_loop(self):
        while True:
            video_id = self.job_queue.get()
            self.current_job = video_id
            track = self.tracks.get(video_id)
            if not track:
                self.job_queue.task_done()
                continue

            try:
                print(f"[Local Demucs] Starting separation: {video_id}...")
                track["status"] = "PROCESSING"
                self._save_tracks()

                self._process_demucs(track)

                track["status"] = "READY"
                track["has_stems"] = True
                self._cleanup_drive_input(video_id)
                print(f"[Local Demucs] Separation complete: {video_id}!")
            except Exception as e:
                print(f"[Local Demucs] Separation error: {e}")
                track["status"] = "FALLBACK"
                track["error"] = str(e)
            finally:
                self.current_job = None
                self._save_tracks()
                self.job_queue.task_done()

    def _process_demucs(self, track: Dict[str, Any]):
        video_id = track["id"]
        track_dir = os.path.join(CACHE_DIR, video_id)
        original_mp3 = track["original_path"]

        demucs_out_dir = os.path.join(track_dir, "demucs_temp")
        os.makedirs(demucs_out_dir, exist_ok=True)

        runner, runner_type = ai_engine_manager.get_demucs_runner()
        if not runner:
            raise RuntimeError("Demucs AI Engine is not installed on this machine. Please install it or use Google Colab.")

        cmd = list(runner) + [
            "-n", "htdemucs",
            "-d", self.device,
            "-o", demucs_out_dir,
            original_mp3
        ]
        if self.device == "cpu":
            cmd.extend(["-j", "2"])

        creationflags = 0x00004000 if sys.platform == "win32" else 0
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=creationflags, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Demucs failed ({runner_type}): {result.stderr[-500:]}")

        stems_dir = os.path.join(demucs_out_dir, "htdemucs", "original")
        drums_path = os.path.join(stems_dir, "drums.wav")
        bass_path = os.path.join(stems_dir, "bass.wav")
        other_path = os.path.join(stems_dir, "other.wav")
        vocals_path = os.path.join(stems_dir, "vocals.wav")

        other_seg = AudioSegment.from_wav(other_path)
        drums_seg = AudioSegment.from_wav(drums_path)
        bass_seg = AudioSegment.from_wav(bass_path)
        vocals_seg = AudioSegment.from_wav(vocals_path)

        min_len = min(len(other_seg), len(drums_seg), len(bass_seg), len(vocals_seg))
        other_seg = other_seg[:min_len]
        drums_seg = drums_seg[:min_len]
        bass_seg = bass_seg[:min_len]
        vocals_seg = vocals_seg[:min_len]

        vocals_seg.export(os.path.join(track_dir, "vocals.mp3"), format="mp3", bitrate="320k")
        other_seg.export(os.path.join(track_dir, "other.mp3"), format="mp3", bitrate="320k")
        bass_seg.export(os.path.join(track_dir, "bass.mp3"), format="mp3", bitrate="320k")
        drums_seg.export(os.path.join(track_dir, "drums.mp3"), format="mp3", bitrate="320k")

        # Xuất metadata.json đồng nhất với chuẩn Colab
        meta_file = os.path.join(track_dir, "metadata.json")
        try:
            meta_data = {
                "video_id": video_id,
                "title": track.get("title", ""),
                "duration": track.get("duration", int(min_len / 1000)),
                "bitrate": "320kbps",
                "processed_by": f"Local Demucs ({self.device.upper()})",
                "status": "READY",
                "created_at": time.time()
            }
            with open(meta_file, "w", encoding="utf-8") as mf:
                json.dump(meta_data, mf, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Metadata] Error writing local metadata.json: {e}")

        shutil.rmtree(demucs_out_dir, ignore_errors=True)

    def process_track_local(self, track_id: str) -> Dict[str, Any]:
        track = self.tracks.get(track_id)
        if not track:
            return {"status": "error", "message": f"Track {track_id} not found"}
        if track.get("has_stems"):
            return {"status": "noop", "message": "Track already has 4 stems ready"}

        track["status"] = "QUEUED"
        track.pop("error", None)
        self.job_queue.put(track_id)
        self._save_tracks()
        return {"status": "success", "track": track}

    def dispatch_track_to_colab(self, track_id: str) -> Dict[str, Any]:
        track = self.tracks.get(track_id)
        if not track:
            return {"status": "error", "message": f"Track {track_id} not found"}
        if track.get("has_stems"):
            return {"status": "noop", "message": "Track already has 4 stems ready"}

        original_mp3 = track.get("original_path") or os.path.join(CACHE_DIR, track_id, "original.mp3")
        if not os.path.exists(original_mp3):
            return {"status": "error", "message": "Original audio file not found on disk"}

        input_drive_file = os.path.join(self.drive_sync_dir, "01_Input_Audio", f"{track_id}.mp3")
        try:
            self._ensure_drive_folders()
            shutil.copy2(original_mp3, input_drive_file)
            track["status"] = "WAITING_COLAB"
            track.pop("error", None)
            self._save_tracks()
            return {"status": "success", "track": track}
        except Exception as e:
            return {"status": "error", "message": f"Failed to dispatch to Drive: {str(e)}"}

    def batch_action(self, action: str, track_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        target_ids = track_ids if track_ids is not None else [
            tid for tid, t in self.tracks.items() if not t.get("has_stems")
        ]
        results = []
        for tid in target_ids:
            if action == "process_local":
                res = self.process_track_local(tid)
            elif action == "dispatch_colab":
                res = self.dispatch_track_to_colab(tid)
            else:
                res = {"status": "error", "message": f"Unknown action: {action}"}
            results.append({"track_id": tid, "result": res})
        return {"status": "success", "processed_count": len(results), "results": results}

    def get_queue_status(self) -> Dict[str, Any]:
        return {
            "queue_size": self.job_queue.qsize(),
            "download_queue_size": self.download_queue.qsize(),
            "current_download": self.current_download,
            "current_job": self.current_job,
            "device": self.device,
            "engine_mode": self.engine_mode,
            "pending_colab_count": self.get_pending_colab_count(),
            "drive_sync_dir": self.drive_sync_dir,
            "tracks_version": self.tracks_version,
            "ai_engine": ai_engine_manager.get_status()
        }

audio_pipeline = AudioPipeline()
