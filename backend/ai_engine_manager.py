import os
import sys
import shutil
import subprocess
import threading
import time
from typing import Optional, List, Tuple, Dict, Any

AI_ENGINE_DIR = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    "AdaptiveFlow",
    "ai_engine"
)

class AIEngineManager:
    def __init__(self):
        self.install_state = "idle"  # idle, installing, ready, failed
        self.install_progress = 0
        self.install_message = ""
        self.install_logs: List[str] = []
        self._lock = threading.Lock()

    def get_demucs_runner(self) -> Tuple[Optional[List[str]], str]:
        """
        Tìm kiếm công cụ thực thi Demucs theo thứ tự ưu tiên:
        1. Gói AI Engine Portable trong AppData (%LOCALAPPDATA%/AdaptiveFlow/ai_engine)
        2. Nếu đang chạy dev (chưa freeze): dùng chính sys.executable nếu có demucs
        3. demucs CLI độc lập trong PATH
        4. Python / Python3 hệ thống có cài demucs
        """
        # 1. Kiểm tra Embedded / Portable AI Engine
        embedded_py = os.path.join(AI_ENGINE_DIR, "python.exe")
        if os.path.exists(embedded_py):
            try:
                res = subprocess.run(
                    [embedded_py, "-c", "import demucs"],
                    capture_output=True,
                    timeout=4,
                    creationflags=0x00004000 if sys.platform == "win32" else 0
                )
                if res.returncode == 0:
                    return [embedded_py, "-m", "demucs.separate"], "EMBEDDED"
            except Exception:
                pass

        # 2. Nếu đang chạy môi trường phát triển (không phải bản đóng gói frozen)
        if not getattr(sys, "frozen", False):
            try:
                res = subprocess.run(
                    [sys.executable, "-c", "import demucs"],
                    capture_output=True,
                    timeout=3,
                    creationflags=0x00004000 if sys.platform == "win32" else 0
                )
                if res.returncode == 0:
                    return [sys.executable, "-m", "demucs.separate"], "DEV_PYTHON"
            except Exception:
                pass

        # 3. Kiểm tra demucs CLI độc lập
        demucs_cli = shutil.which("demucs")
        if demucs_cli:
            try:
                res = subprocess.run(
                    [demucs_cli, "--help"],
                    capture_output=True,
                    timeout=4,
                    creationflags=0x00004000 if sys.platform == "win32" else 0
                )
                if res.returncode == 0:
                    return [demucs_cli], "SYSTEM_DEMUCS"
            except Exception:
                pass

        # 4. Kiểm tra Python hệ thống (python, python3, py)
        for py_cmd in ["python", "python3", "py"]:
            py_path = shutil.which(py_cmd)
            if py_path:
                try:
                    res = subprocess.run(
                        [py_path, "-c", "import demucs"],
                        capture_output=True,
                        timeout=4,
                        creationflags=0x00004000 if sys.platform == "win32" else 0
                    )
                    if res.returncode == 0:
                        return [py_path, "-m", "demucs.separate"], "SYSTEM_PYTHON"
                except Exception:
                    continue

        return None, "NONE"

    def detect_gpu_info(self) -> Dict[str, Any]:
        """Phát hiện GPU NVIDIA và thông tin phần cứng"""
        gpu_name = "None"
        has_nvidia = False

        if sys.platform == "win32":
            try:
                out = subprocess.check_output(
                    ["wmic", "path", "win32_VideoController", "get", "name"],
                    text=True,
                    creationflags=0x00004000
                )
                lines = [l.strip() for l in out.splitlines() if l.strip() and "Name" not in l]
                if lines:
                    gpu_name = lines[0]
                    has_nvidia = any("nvidia" in l.lower() or "geforce" in l.lower() or "rtx" in l.lower() for l in lines)
            except Exception:
                pass

        # Kiểm tra CUDA nếu có thể
        cuda_ready = False
        runner, _ = self.get_demucs_runner()
        if runner:
            try:
                check_cmd = [runner[0], "-c", "import torch; print(torch.cuda.is_available())"]
                res = subprocess.run(
                    check_cmd,
                    capture_output=True,
                    text=True,
                    timeout=4,
                    creationflags=0x00004000 if sys.platform == "win32" else 0
                )
                if "True" in res.stdout:
                    cuda_ready = True
            except Exception:
                pass

        return {
            "gpu_name": gpu_name,
            "has_nvidia": has_nvidia,
            "cuda_ready": cuda_ready,
            "device": "cuda" if cuda_ready else "cpu"
        }

    def get_status(self) -> Dict[str, Any]:
        runner, runner_type = self.get_demucs_runner()
        gpu_info = self.detect_gpu_info()

        return {
            "installed": runner is not None,
            "runner_type": runner_type,
            "device": gpu_info["device"],
            "gpu_name": gpu_info["gpu_name"],
            "has_nvidia": gpu_info["has_nvidia"],
            "cuda_ready": gpu_info["cuda_ready"],
            "install_state": self.install_state,
            "install_progress": self.install_progress,
            "install_message": self.install_message,
            "recent_logs": self.install_logs[-5:],
            "ai_engine_dir": AI_ENGINE_DIR
        }

    def start_install(self) -> Dict[str, Any]:
        with self._lock:
            if self.install_state == "installing":
                return {"status": "in_progress", "message": "Installation already in progress"}
            self.install_state = "installing"
            self.install_progress = 5
            self.install_message = "Starting AI Engine setup..."
            self.install_logs = ["Initialized installation manager..."]

        threading.Thread(target=self._run_install_pipeline, daemon=True).start()
        return {"status": "started", "message": "Installation launched"}

    def _run_install_pipeline(self):
        try:
            # Bước 1: Kiểm tra xem hệ thống có Python & pip không
            sys_python = shutil.which("python") or shutil.which("python3")
            if sys_python:
                self._update_progress(15, f"Detected system Python: {sys_python}. Installing Demucs...")
                cmd = [sys_python, "-m", "pip", "install", "--upgrade", "demucs"]
                creationflags = 0x00004000 if sys.platform == "win32" else 0
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    creationflags=creationflags
                )

                for line in iter(process.stdout.readline, ""):
                    if not line:
                        break
                    clean_line = line.strip()
                    if clean_line:
                        self.install_logs.append(clean_line)
                        if "Downloading" in clean_line:
                            self._update_progress(min(self.install_progress + 5, 80), f"Downloading: {clean_line[:60]}...")
                        elif "Installing" in clean_line:
                            self._update_progress(min(self.install_progress + 3, 90), f"Installing components...")

                process.stdout.close()
                process.wait()

                if process.returncode == 0:
                    runner, r_type = self.get_demucs_runner()
                    if runner:
                        self._finish_install(True, f"Demucs installed successfully ({r_type})!")
                        return

            # Bước 2: Tạo thư mục độc lập nếu cần
            os.makedirs(AI_ENGINE_DIR, exist_ok=True)
            self._update_progress(50, "Preparing isolated AI Engine environment...")
            self.install_logs.append(f"AI Engine target folder: {AI_ENGINE_DIR}")

            # Đánh giá hoàn tất
            runner, r_type = self.get_demucs_runner()
            if runner:
                self._finish_install(True, f"AI Engine is ready ({r_type})!")
            else:
                self._finish_install(
                    False,
                    "Automated pip installation did not complete. Please use Colab or install Python & run 'pip install demucs'."
                )
        except Exception as e:
            self._finish_install(False, f"Setup error: {str(e)}")

    def _update_progress(self, progress: int, message: str):
        with self._lock:
            self.install_progress = progress
            self.install_message = message

    def _finish_install(self, success: bool, message: str):
        with self._lock:
            self.install_state = "ready" if success else "failed"
            self.install_progress = 100 if success else 0
            self.install_message = message
            self.install_logs.append(f"Result: {message}")

ai_engine_manager = AIEngineManager()
