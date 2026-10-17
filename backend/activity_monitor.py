import sys
import time
import ctypes
from typing import Dict, Any

class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint),
        ("dwTime", ctypes.c_uint)
    ]

class ActivityMonitor:
    """
    Theo dõi thời gian rảnh rỗi của hệ thống (System Idle Time) bằng Windows Native API.
    Tuyệt đối không hook bàn phím, không ghi nhận ký tự (Zero-Security Risk).
    Xử lý chống tràn số DWORD (49.7 ngày uptime).
    """

    def __init__(self, fatigue_idle_threshold: float = 60.0, nudge_duration: float = 15.0, cooldown_seconds: float = 600.0):
        self.is_windows = sys.platform == "win32"
        self.fatigue_idle_threshold = fatigue_idle_threshold  # Giây không chạm máy tính để coi là uể oải
        self.nudge_duration = nudge_duration                  # Thời gian đẩy beat 0.45 (15 giây)
        self.cooldown_seconds = cooldown_seconds              # 10 phút hồi chiêu giữa 2 lần nudge

        self.auto_fatigue_enabled = True
        self.energy_level = 0.0                               # S_energy [0.0, 1.0]
        self.current_state = "DEEP_FOCUS"

        self.last_nudge_timestamp = 0.0
        self.nudge_expiry_timestamp = 0.0
        self.manual_burst_expiry_timestamp = 0.0
        self.was_idle_fatigued = False                        # Đánh dấu đã vượt ngưỡng uể oải, chờ chạm lại máy

        self.pomodoro_start_time = time.time()
        self.pomodoro_interval = 50 * 60                      # 50 phút
        self.break_duration = 5 * 60                          # 5 phút nghỉ
        self.in_break = False

    def get_idle_seconds(self) -> float:
        """
        Lấy số giây hệ thống không nhận được tương tác chuột/phím.
        Khắc phục lỗi tràn số DWORD (49.7 ngày).
        """
        if not self.is_windows:
            # Fallback mô phỏng cho môi trường non-windows (nếu có)
            return 0.0

        try:
            lpi = LASTINPUTINFO()
            lpi.cbSize = ctypes.sizeof(LASTINPUTINFO)
            if ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lpi)):
                tick_count = ctypes.windll.kernel32.GetTickCount()
                # 32-bit unsigned modulo để an toàn khi GetTickCount rollover
                raw_diff = (tick_count - lpi.dwTime) & 0xFFFFFFFF
                return raw_diff / 1000.0
        except Exception:
            pass
        return 0.0

    def trigger_manual_burst(self, duration_seconds: float = 30.0) -> None:
        """Kích hoạt Drop-Beat toàn phần thủ công (S_energy = 1.0)"""
        now = time.time()
        self.manual_burst_expiry_timestamp = now + duration_seconds
        self.energy_level = 1.0
        self.current_state = "MANUAL_BURST"

    def set_auto_fatigue(self, enabled: bool) -> None:
        self.auto_fatigue_enabled = enabled

    def reset_pomodoro(self) -> None:
        self.pomodoro_start_time = time.time()
        self.in_break = False

    def tick(self) -> Dict[str, Any]:
        """
        Được gọi mỗi 1 giây để cập nhật trạng thái năng lượng S_energy.
        """
        now = time.time()
        idle_sec = self.get_idle_seconds()

        # 1. Kiểm tra ưu tiên: Manual Burst (phím tắt)
        if now < self.manual_burst_expiry_timestamp:
            self.energy_level = 1.0
            self.current_state = "MANUAL_BURST"
            return self._build_status(idle_sec)

        # 2. Kiểm tra Pomodoro 50 phút
        elapsed_work = now - self.pomodoro_start_time
        if elapsed_work >= self.pomodoro_interval:
            if elapsed_work < (self.pomodoro_interval + self.break_duration):
                self.in_break = True
                self.energy_level = 0.8
                self.current_state = "BREAK_TIME"
                return self._build_status(idle_sec)
            else:
                # Kết thúc 5 phút break, reset lại chu kỳ làm việc
                self.reset_pomodoro()

        # 3. Kiểm tra Nudge đang diễn ra
        if now < self.nudge_expiry_timestamp:
            self.energy_level = 0.45
            self.current_state = "FATIGUE_NUDGE"
            return self._build_status(idle_sec)

        # 4. Logic nhận diện uể oải / quay lại làm việc
        if self.auto_fatigue_enabled:
            if idle_sec >= self.fatigue_idle_threshold:
                # Đã không chạm máy tính quá 60s -> đánh dấu là đang uể oải/rời bàn
                self.was_idle_fatigued = True
            elif self.was_idle_fatigued and idle_sec < 2.0:
                # Vừa chạm lại vào phím/chuột sau thời gian nghỉ dài!
                self.was_idle_fatigued = False
                can_nudge = (now - self.last_nudge_timestamp) >= self.cooldown_seconds
                if can_nudge:
                    self.last_nudge_timestamp = now
                    self.nudge_expiry_timestamp = now + self.nudge_duration
                    self.energy_level = 0.45
                    self.current_state = "FATIGUE_NUDGE"
                    return self._build_status(idle_sec)

        # 5. Trạng thái bình thường
        if idle_sec < 10.0:
            self.energy_level = 0.0
            self.current_state = "DEEP_FOCUS"
        else:
            self.energy_level = 0.0
            self.current_state = "THINKING"

        return self._build_status(idle_sec)

    def _build_status(self, idle_sec: float) -> Dict[str, Any]:
        return {
            "idle_seconds": round(idle_sec, 1),
            "energy_level": round(self.energy_level, 2),
            "state": self.current_state,
            "auto_fatigue_enabled": self.auto_fatigue_enabled,
            "pomodoro": {
                "elapsed_seconds": int(time.time() - self.pomodoro_start_time),
                "in_break": self.in_break
            }
        }

if __name__ == "__main__":
    monitor = ActivityMonitor()
    print("Testing ActivityMonitor for 3 seconds...")
    for _ in range(3):
        print(monitor.tick())
        time.sleep(1)
