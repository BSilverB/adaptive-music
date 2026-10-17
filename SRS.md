# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
**Tên dự án:** Adaptive Flow & Beat Engine (Web & Desktop Companion Edition)  
**Phiên bản:** 2.0 (MVP)  
**Ngày cập nhật:** Tháng 10, 2026  

---

## 1. Giới thiệu tổng quan hệ thống

### 1.1. Mục đích
**Adaptive Flow & Beat Engine** là ứng dụng web chạy trên máy tính, giải quyết nỗi đau phân cực năng lượng của người làm việc hiệu suất cao (lập trình viên, nhà sáng tạo nội dung): khi cần tập trung sâu thì cần nhạc không lời êm dịu, nhưng khi uể oải hoặc vận động giải lao lại cần nhạc có nhịp trống (Beat/Bass) mạnh mẽ. 

Điểm độc đáo của hệ thống là sử dụng **chính danh sách phát (Playlist) YouTube quen thuộc của cá nhân**, tự động bóc tách và biến thiên cấu trúc âm thanh theo thời gian thực dựa trên trạng thái làm việc thực tế mà không đòi hỏi người dùng phải thao tác đổi bài thủ công.

### 1.2. Đối tượng sử dụng
* **Knowledge Workers / Developers:** Những người làm việc nhiều giờ trên máy tính, nghe nhạc lặp lại để giữ nhịp tập trung nhưng cần tín hiệu âm thanh tự nhiên để nhắc nhở giải lao và nạp năng lượng.

### 1.3. Kiến trúc tổng thể (Hybrid Local-Web Architecture)
* **Frontend (React + Tailwind CSS + Web Audio API):** Giao diện quản lý playlist, trực quan hóa thanh năng lượng ($S_{energy}$), và xử lý bộ trộn âm thanh (Audio Engine) đa luồng.
* **Local Backend Worker (Python FastAPI + `yt-dlp` + `Demucs`):** Chạy ngầm cục bộ trên máy tính để tải video/playlist YouTube, dùng mô hình AI (`htdemucs`) tách thành 2 luồng âm thanh độc lập và lưu cache vĩnh viễn trên ổ cứng.
* **Activity Monitor (Python `pynput` / Global Hotkey):** Lắng nghe tần suất thao tác phím/chuột hoặc nhận lệnh phím tắt (`Global Hotkey`) để điều phối trạng thái âm nhạc.

---

## 2. Yêu cầu Chức năng (Functional Requirements)

### 2.1. Phân hệ Quản lý & Tách lớp Âm thanh (Audio Pipeline & Caching)

| Mã YC | Tên chức năng | Mô tả chi tiết xử lý kỹ thuật |
| :--- | :--- | :--- |
| **FR-01** | **Nhập Playlist / URL YouTube** | Người dùng dán URL bài hát hoặc Playlist YouTube. Hệ thống dùng `yt-dlp` quét và trích xuất danh sách video (`video_id`, title, duration). |
| **FR-02** | **Xử lý Tách lớp AI ngầm (`Demucs` Stem Splitter)** | Khi thêm bài hát mới, Backend tự động tải file gốc (`original.mp3`) và chạy ngầm mô hình AI `htdemucs` để băm bài hát thành 4 dải: `drums`, `bass`, `other`, `vocals`. Sau đó tự động gộp thành 2 file đồng bộ pha lưu vào thư mục local:<br>1. `calm_stem.mp3` (Chứa lớp giai điệu nền `other`).<br>2. `energy_stem.mp3` (Chứa `drums` + `bass` + `vocals`). |
| **FR-03** | **Cơ chế Fallback Tức thời (Zero-Wait Fallback)** | Đối với các bài hát mới nạp chưa kịp tách bằng AI, hệ thống phát ngay luồng gốc thông qua `BiquadFilterNode` (giả lập dải lọc tần số Lo-Fi/Ambient) để người dùng không phải chờ đợi. Từ lần nghe thứ 2 trở đi, hệ thống ưu tiên nạp thẳng cặp file Stems đã cache từ ổ cứng. |

---

### 2.2. Phân hệ Trộn Âm thanh Thích ứng (Web Audio Adaptive Engine)

| Mã YC | Tên chức năng | Mô tả chi tiết xử lý kỹ thuật |
| :--- | :--- | :--- |
| **FR-04** | **Khóa đồng bộ pha tuyệt đối (Sample-Accurate Synchronization)** | Dùng chung một mốc thời gian `AudioContext.currentTime` để khởi chạy đồng thời `calm_stem.mp3` và `energy_stem.mp3`. Đảm bảo độ lệch pha luôn bằng **0ms** kể cả khi tua nhạc (seek) hoặc chuyển đổi trạng thái liên tục. |
| **FR-05** | **Biến thiên mượt mà theo Chỉ số Năng lượng ($S_{energy}$)** | Đầu vào của Engine là hệ số $S_{energy} \in [0.0, 1.0]$:<br>• `GainNode(calm_stem)` luôn giữ cố định ở mức **0.85**.<br>• `GainNode(energy_stem)` biến thiên tuyến tính (`linearRampToValueAtTime`) theo giá trị $S_{energy}$.<br>• `BiquadFilterNode(Low-pass)` trên luồng `energy_stem` mở rộng tần số cắt từ **400Hz** ($S_{energy} = 0.2$) lên **20.000Hz** ($S_{energy} \ge 0.8$). |

---

### 2.3. Phân hệ Điều phối Trạng thái & Kịch bản Sử dụng (State & Interaction)

| Mã YC | Tên chức năng | Mô tả chi tiết xử lý kỹ thuật |
| :--- | :--- | :--- |
| **FR-06** | **Deep Work Mode (Chế độ Tập trung sâu)** | Khi người dùng cặm cụi làm việc/viết code, hệ thống duy trì $S_{energy} = 0.0$. Chỉ phát lớp nhạc nền êm dịu (`calm_stem`), hoàn toàn triệt tiêu tiếng trống và lời ca để chống xao nhãng. |
| **FR-07** | **Smart Fatigue Trigger (Phát hiện uể oải qua thao tác)** | Script Python đo tần suất gõ phím ($K$) và phím xóa `Backspace` ($K_{err}$) trong cửa sổ **10 giây**. Nếu phát hiện tốc độ gõ giảm dần đều kèm tỷ lệ gõ sai cao hoặc ngừng thao tác bất thường, hệ thống tự động đẩy nhẹ $S_{energy}$ lên **0.45** trong **15 giây** để âm bass trầm đánh thức sự tỉnh táo một cách tự nhiên. |
| **FR-08** | **Micro-Break Auto Drop-Beat (Tự động đổi nhịp giải lao)** | Sau mỗi **50 phút** làm việc liên tục, khi chuyển bài, hệ thống tự động kích hoạt chế độ giải lao trong 5 phút đầu: đẩy $S_{energy} = 0.8$ để bản nhạc bùng nổ tiếng beat, đóng vai trò là "tín hiệu sinh học" nhắc nhở người dùng đứng dậy vươn vai. |
| **FR-09** | **Manual Kinetic Toggle (Phím tắt chuyển đổi trạng thái nhanh)** | Cho phép người dùng bấm phím tắt toàn cục (`Global Hotkey` như `Ctrl + Space`) khi chuẩn bị đứng dậy vận động hoặc nhảy tại phòng. Lập tức bản nhạc thực hiện `Drop Beat` toàn phần ($S_{energy} = 1.0$), và hạ ngược lại trạng thái êm dịu khi bấm phím tắt khi ngồi xuống ghế. |

---

## 3. Ma trận Chuyển đổi Trạng thái Âm thanh (State Transition Matrix)

| Trạng thái Người dùng | Tác nhân kích hoạt (Trigger) | Giá trị $S_{energy}$ | Phản ứng của Âm thanh (Audio Behavior) | Thời gian chuyển (Ramp Time) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Deep Focus** | Gõ phím đều đặn, tập trung viết code/tài liệu | $0.0 \rightarrow 0.1$ | Chỉ phát lớp `calm_stem` (Melody/Ambient). Triệt tiêu toàn bộ tiếng trống và lời hát. | **5.0 giây** (Hạ mượt) |
| **2. Fatigue Nudge** | Tốc độ gõ phím suy giảm, tỷ lệ xóa phím tăng | $0.45$ | Mở nhẹ lớp `energy_stem`, áp dụng bộ lọc tần số thấp để giữ tiếng bass trầm kích thích não bộ. | **15.0 giây** (Tăng từ từ không giật mình) |
| **3. Micro-Break / Stretch** | Đạt mốc 50 phút làm việc hoặc bấm phím tắt chuyển đổi | $0.80$ | Mở rộng dải tần, đưa tiếng trống (`drums`) và bass vào rõ ràng, tạo hưng phấn vận động nhẹ. | **2.0 giây** |
| **4. Full Kinetic Drop** | Người dùng đứng dậy vận động / Nhảy tự do (Kích hoạt Hotkey) | $1.00$ | Mở 100% `energy_stem`, bung trọn vẹn dải Bass và Vocals, tạo năng lượng tối đa. | **0.8 giây** (Bắt nhịp tức thì) |

---

## 4. Yêu cầu Phi chức năng (Non-Functional Requirements)

1. **Hiệu năng & Tài nguyên:**
   * Khi ở chế độ nghe nhạc thông thường (Deep Work), ứng dụng tiêu thụ không quá **2% CPU** và **200MB RAM**.
   * Quá trình tách nhạc bằng AI (`Demucs`) được đặt ở tiến trình nền ưu tiên thấp (Low Priority Queue), không làm gián đoạn các tác vụ nặng trên máy tính.
2. **Quyền riêng tư tuyệt đối (Privacy-First):**
   * Module theo dõi bàn phím chỉ tính toán số lượng sự kiện thô (`key_count += 1`), tuyệt đối không ghi nhận mã phím ký tự (Keylogger-free), đảm bảo an toàn bảo mật tuyệt đối cho lập trình viên.
3. **Tính ổn định & Trải nghiệm:**
   * Độ trễ chuyển đổi trạng thái (Transition Latency) giữa các mức năng lượng phải dưới **100 mili-giây** để âm thanh không bị khựng, giật cục hoặc lệch pha.

---

## 5. Cấu trúc Thư mục Dự án MVP

```text
adaptive-flow-engine/
├── backend/
│   ├── main.py                # FastAPI Server & WebSocket Hub
│   ├── activity_monitor.py    # Script pynput đếm nhịp thao tác phím/chuột
│   ├── audio_pipeline.py      # Worker tích hợp yt-dlp và Demucs (Stem Splitter)
│   └── cache_stems/           # Thư mục lưu trữ các cặp file (calm_stem.mp3, energy_stem.mp3)
└── frontend/
    ├── src/
    │   ├── audio/
    │   │   └── AdaptiveEngine.ts  # Quản lý Web Audio API, GainNodes & BiquadFilter
    │   ├── hooks/
    │   │   └── useDesktopSocket.ts    # Đồng bộ trạng thái năng lượng thời gian thực
    │   └── components/
    │       ├── FlowMeter.tsx          # Thanh hiển thị mức năng lượng trực quan (0% -> 100%)
    │       └── PlaylistView.tsx       # Quản lý danh sách YouTube & trạng thái cache AI
```