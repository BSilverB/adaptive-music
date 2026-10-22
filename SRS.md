# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SOFTWARE REQUIREMENTS SPECIFICATION - SRS)

**Tên dự án:** Adaptive Flow & Beat Engine (Commercial & Developer Edition)  
**Phiên bản tài liệu:** v3.0 (Full Architecture & Engineering Reference)  
**Ngày cập nhật:** Tháng 10, 2026  
**Định vị sản phẩm:** Standalone Neuro-Focus Audio Workstation & Player (Phần mềm tối ưu trạng thái tập trung sâu & thích ứng sinh học cá nhân)  
**Mô hình cốt lõi:** **BYOA (Bring Your Own Audio)** – Người dùng tự nạp nhạc, lưu trữ cục bộ 100% (*Local-First*), vận hành phân tán không tốn chi phí máy chủ (*Zero-Cost Distributed Pipeline*).

---

## MỤC LỤC
1. [Giới Thiệu Tổng Quan & Tuyên Ngôn Định Vị](#1-giới-thiệu-tổng-quan--tuyên-ngôn-định-vị)
2. [Bản Đồ Công Nghệ & Giải Trình Lựa Chọn Kỹ Thuật (Architecture & Tech Stack)](#2-bản-đồ-công-nghệ--giải-trình-lựa-chọn-kỹ-thuật)
   * 2.1. Tại sao dùng Web Audio API trên Frontend?
   * 2.2. So sánh 3 chế độ tách nhạc AI: Colab GPU vs Local GPU (CUDA) vs Local CPU
   * 2.3. Cơ chế trạm trung chuyển Google Drive 3 thư mục
   * 2.4. Chiến lược quản lý bộ nhớ RAM & Bộ nhớ đệm (Multi-Tier Caching)
3. [Đặc Tả Yêu Cầu Chức Năng (Functional Requirements)](#3-đặc-tả-yêu-cầu-chức-năng)
   * Phân hệ 1: Nạp nhạc đa nguồn (BYOA Local File/Folder & YouTube Decoupled)
   * Phân hệ 2: Bàn trộn Mini-Mixer 4 Kênh độc lập & Presets
   * Phân hệ 3: Bộ xử lý âm thanh thích ứng theo nhịp sinh học (Dynamic Audio Engine)
   * Phân hệ 4: Tầng âm thanh bí mật (40Hz Gamma & Brown Noise)
   * Phân hệ 5: Không gian âm thanh 8D tự xoay quanh não (Binaural Spatial 8D HRTF)
   * Phân hệ 6: Chuyển bài thông minh DJ Beat-Matched Crossfade
   * Phân hệ 7: Nhận diện cuộc họp thông minh (Meeting / Call Auto-Ducking)
   * Phân hệ 8: Nút bùng nổ năng lượng khẩn cấp (Emergency Drop Beat 15s)
   * Phân hệ 9: Thống kê hiệu suất làm việc Dev-Wrapped (GitHub-style Heatmap)
   * Phân hệ 10: Giao diện thị giác 4-Stem Cyberpunk Visualizer (60fps LERP)
   * Phân hệ 11: Quản lý Playlists, Kéo-thả & Sửa tên trực tiếp (Inline Edit)
4. [Khung Pháp Lý, Bản Quyền & Miễn Trừ Trách Nhiệm](#4-khung-pháp-lý-bản-quyền--miễn-trừ-trách-nhiệm)
5. [Đặc Tả Yêu Cầu Phi Chức Năng (Non-Functional Requirements)](#5-đặc-tả-yêu-cầu-phi-chức-năng)
6. [Cấu Trúc Thư Mục & Bản Đồ Mã Nguồn (Codebase Architecture)](#6-cấu-trúc-thư-mục--bản-đồ-mã-nguồn)

---

## 1. GIỚI THIỆU TỔNG QUAN & TUYÊN NGÔN ĐỊNH VỊ

### 1.1. Giải quyết nghịch lý "Deep Work" của Lập trình viên
* **Nhạc tập trung truyền thống (Lofi, White Noise):** Thường đơn điệu, dễ gây buồn ngủ sau 45–60 phút và triệt tiêu động lực làm việc khi gặp các tác vụ nặng cần sự bứt phá.
* **Nhạc giải trí thông thường (Pop/Rock/EDM):** Chứa giọng hát (vocals) và nhịp trống giậm liên tục, kích thích vùng ngôn ngữ bán cầu não trái, gây phân tâm khi đọc tài liệu kỹ thuật hoặc viết mã nguồn.
* **Giải pháp của Adaptive Flow Engine:** Người dùng nghe **chính những bài hát ruột của mình**, nhưng hệ thống tự động:
  * *Khi viết code tập trung:* Tắt giọng hát, hạ êm tiếng trống, mở dải giai điệu Synth/Piano trôi bồng bềnh.
  * *Khi phát hiện uể oải:* Bơm nhẹ âm bass trầm để đánh thức sự tỉnh táo một cách êm ái.
  * *Khi giải quyết xong bug / merge Pull Request:* Cho phép bùng nổ toàn bộ bản nhạc trong 15 giây ăn mừng (*Drop Beat*) rồi tự động êm dịu trở lại.

### 1.2. Tuyên ngôn định vị thương mại
1. **Chúng ta KHÔNG bán âm nhạc:** Không cạnh tranh với Spotify hay Apple Music về kho bài hát.
2. **Chúng ta bán HỆ ĐIỀU HÀNH TẬP TRUNG TRÍ NÃO (Flow OS):** Cung cấp công cụ công nghệ giúp người dùng chuyển hóa bài hát cá nhân thành các dải sóng âm thích ứng sinh học.
3. **Mô hình BYOA (Bring Your Own Audio):** Người dùng làm chủ 100% dữ liệu nạp vào.

---

## 2. BẢN ĐỒ CÔNG NGHỆ & GIẢI TRÌNH LỰA CHỌN KỸ THUẬT

Sơ đồ tổng quan luồng vận hành phân tán không tốn chi phí máy chủ:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MÁY TÍNH NGƯỜI DÙNG (LOCAL)                            │
│                                                                                        │
│   ┌────────────────────────────────────────┐     ┌───────────────────────────────────┐ │
│   │        GIAO DIỆN REACT + TAILWIND      │     │      PYTHON FASTAPI BACKEND       │ │
│   │  • Web Audio API (4 Stems Mixing)      │◄───►│  • Activity Monitor (pynput)      │ │
│   │  • 8D HRTF PannerNode (Melody Orbit)   │ WS  │  • Audio Pipeline (Local Cache)   │ │
│   │  • 40Hz Gamma & Brown Noise Generator  │     │  • Drive Watcher Daemon           │ │
│   │  • Meeting Auto-Ducking (Micro RMS)    │     │  • ffprobe Metadata Extractor     │ │
│   └────────────────────────────────────────┘     └─────────────────┬─────────────────┘ │
│                       ▲                                            │                   │
│                       │ Local Disk Playback                        │ Copy Input Audio  │
│                       ▼                                            ▼                   │
│          Thư mục Cache: backend/cache_stems/          Google Drive: 01_Input_Audio/    │
└────────────────────────────────────────────────────────────────────┬───────────────────┘
                                                                     │
                                         Google Drive Cloud Sync     │
                                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             GOOGLE COLAB CLOUD GPU (MIỄN PHÍ)                          │
│                                                                                        │
│   • Phần cứng: Card đồ họa đám mây NVIDIA Tesla T4 (16GB VRAM)                         │
│   • Mô hình AI: Meta AI Demucs v4 (htdemucs) băm 4 kênh độc lập                        │
│   • Librosa: Đo chỉ số BPM và phân tích phổ âm                                         │
│   • Quy trình: 01_Input_Audio ──(Tách Demucs)──► 03_Output_Stems ──► Dời sang 02_Processed│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Tại sao dùng Web Audio API trên Frontend?
* **Đồng bộ pha chính xác đến mẫu (Sample-Accurate Sync 0ms):** Thẻ `<audio>` của HTML5 bị trễ từ 50–200ms giữa các luồng phát, khiến việc phát song song 4 stems bị lệch nhịp như gõ nồi niêu. Web Audio API sử dụng chung một trục đồng hồ phần cứng âm thanh (`audioCtx.currentTime`), cho phép phát đồng thời 4 luồng âm thanh với độ lệch pha tuyệt đối bằng **0ms**.
* **Xử lý tín hiệu thời gian thực (Zero CPU Load):** Web Audio API tận dụng DSP tích hợp của trình duyệt:
  * `BiquadFilterNode`: Tạo bộ lọc Lowpass thích ứng gọt đẽo tần số trống.
  * `OscillatorNode`: Tự sinh sóng não 40Hz và Brown Noise thuần túy bằng toán học, **không tốn băng thông tải bất kỳ file mp3 phụ trợ nào**.
  * `PannerNode(HRTF)`: Tạo không gian âm thanh 8D 360 độ xoay quanh đầu chuẩn phòng thu.
  * `AnalyserNode`: Trích xuất 1024 điểm phổ tần số để vẽ Visualizer 60fps mà không chiếm dụng CPU.

---

### 2.2. So Sánh 3 Chế Độ Tách Nhạc AI: Colab GPU vs Local GPU vs Local CPU

Dự án thiết kế sẵn 3 chế độ để tương thích từ máy văn phòng mỏng nhẹ đến máy trạm đồ họa:

| Tiêu chí | Chế độ 1: Colab Cloud GPU (Mặc định) | Chế độ 2: Local GPU (NVIDIA CUDA) | Chế độ 3: Local CPU |
| :--- | :--- | :--- | :--- |
| **Phần cứng yêu cầu** | Mọi máy tính (kể cả máy yếu, Mac M-series, Ultrabook) | Máy tính có card đồ họa NVIDIA rời $\ge$ 4GB VRAM | CPU thông thường (Intel Core i5/i7/i9 hoặc AMD Ryzen) |
| **Tốc độ xử lý (Bài 4 phút)** | **~25 - 45 giây/bài** (Siêu nhanh) | **~20 - 35 giây/bài** | **2 - 4 phút/bài** |
| **Tải nhiệt & Quạt máy** | **0% CPU/GPU của máy bạn** (Máy mát rượi, pin trâu) | Card đồ họa nóng ~65–75°C, quạt quay mạnh | CPU chạy 100% tất cả các nhân, quạt kêu to |
| **Chi phí máy chủ** | **0 USD** (Google cấp GPU Tesla T4 miễn phí) | 0 USD | 0 USD |
| **Yêu cầu kết nối** | Cần Google Drive & mở link Colab bấm `Run All` | Hoàn toàn ngoại tuyến (Offline 100%) | Hoàn toàn ngoại tuyến (Offline 100%) |
| **Khuyến nghị sử dụng** | **Khuyên dùng hàng ngày** cho dân văn phòng, coder làm việc liên tục | Dành cho người có PC Gaming / Workstation mạnh | Dành cho trường hợp mất mạng không có internet |

---

### 2.3. Cơ Chế Trạm Trung Chuyển Google Drive (3 Thư Mục Đồng Bộ)

Để đạt chi phí máy chủ **0 USD** mà không bắt máy người dùng phải chịu tải nặng, hệ thống dùng Google Drive cá nhân làm trạm trung chuyển phân tán:

1. **`AdaptiveMusic_Sync/01_Input_Audio/` (Hàng đợi đầu vào - Inbox):**
   * Khi bạn nạp bài mới chưa có stems, App copy file nhạc gốc vào đây.
   * Đây là hàng đợi chờ Colab xử lý.
2. **`AdaptiveMusic_Sync/02_Processed_Audio/` (Lưu trữ đã xử lý - Archive):**
   * Sau khi Colab tách xong bài nào, nó lập tức dùng lệnh `shutil.move()` dời file gốc từ `01_Input` sang `02_Processed`.
   * **Mục đích:** Dọn sạch `01_Input_Audio` để Colab không bao giờ xử lý lại bài cũ.
3. **`AdaptiveMusic_Sync/03_Output_Stems/{track_id}/` (Đầu ra 4 Stems - Outbox):**
   * Chứa 4 file độc lập: `vocals.mp3`, `other.mp3`, `bass.mp3`, `drums.mp3` (320kbps) + `metadata.json` (BPM, Key).
   * Thread ngầm trên máy bạn (`_drive_watcher_loop`) tự động quét mỗi 20 giây và kéo về máy local.

---

### 2.4. Chiến Lược Quản Lý Bộ Nhớ RAM & Bộ Nhớ Đệm (Multi-Tier Caching)

Hệ thống được thiết kế theo 3 tầng đệm tối ưu để ngăn chặn triệt để lỗi tràn bộ nhớ:

* **Tầng 1: Client Memory Cache (Tránh lỗi tràn RAM Web Audio):**
  * Khi người dùng kéo thả cả thư mục 20–50 bài vào giao diện, trình duyệt **TUYỆT ĐỐI KHÔNG giải mã âm thanh (`decodeAudioData`) hàng loạt**.
  * Chỉ phân tích header siêu nhẹ lấy thời lượng và tên bài (tốn vài KB RAM).
  * Chỉ nạp AudioBuffer vào RAM khi người dùng thực sự bấm Play bài hát đó.
* **Tầng 2: Local Disk Cache (`backend/cache_stems/{id}/`):**
  * Mọi bài hát sau khi tải/tách đều được lưu cứng trên ổ cứng máy tính.
  * Tốc độ đọc file đạt ngưỡng mili-giây qua `FastAPI FileResponse`.
  * Lần nghe thứ 2 trở đi hoàn toàn không cần kết nối mạng.
* **Tầng 3: Deduplication SHA-256 Cache:**
  * File nạp từ máy được băm mã nội dung: `loc_{sha256[:12]}`.
  * Đổi tên file cũng không bị tách lại $\rightarrow$ Nhận diện Cache Hit ngay lập tức.

---

## 3. ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### Phân hệ 1: Nạp Nhạc Đa Nguồn (BYOA Local File/Folder & YouTube Decoupled)
* **FR-01.1 (Nạp File / Folder Cục Bộ):** Người dùng có thể kéo thả trực tiếp tệp âm thanh hoặc **cầm nguyên cả thư mục album** thả vào ứng dụng. Hỗ trợ `.mp3`, `.wav`, `.flac`, `.m4a`, `.ogg`.
* **FR-01.2 (Bộ lọc tệp rác thông minh - Sanitization Filter):** Tự động bỏ qua không báo lỗi các tệp rác hệ điều hành (`.DS_Store`, `Thumbs.db`, `desktop.ini`, `.lrc`, `.txt`, `.jpg`,...).
* **FR-01.3 (Hàng đợi nạp nhạc - Worker Queue Concurrency = 2):** Khống chế tối đa 2 tác vụ tải lên cùng lúc để chống nghẽn mạng và chống quá tải hệ thống. Hiển thị qua bảng tiến trình mini [UploadQueuePanel](file:///f:/A-PROJECTS/adaptive-music/frontend/src/components/UploadQueuePanel.tsx).
* **FR-01.4 (Trích xuất YouTube có điều kiện - Decoupled Consent):** Chỉ hỗ trợ nạp URL YouTube sau khi người dùng chủ động bấm chấp thuận hộp thoại EULA/yt-dlp.

---

### Phân hệ 2: Bàn Trộn Mini-Mixer 4 Kênh Độc Lập & Presets 1-Click
* **FR-02.1 (4 Kênh âm thanh độc lập):**
  * 🎤 **Vocals:** Giọng ca sĩ.
  * 🎹 **Melody (`other` stem):** Piano, Guitar, Synth, dải trung.
  * 🎸 **Bass:** Sóng trầm, độ ấm và chiều sâu.
  * 🥁 **Drums:** Tiết tấu, nhịp gõ Kick/Snare/Hi-hat.
* **FR-02.2 (Điều khiển từng kênh):** Nút Mute (Tắt tiếng), Solo (Chỉ nghe kênh này), thanh trượt Fader âm lượng (0% – 100%).
* **FR-02.3 (4 Presets 1-Click):**
  * `[Deep Focus]`: Tắt Vocals, giảm Drums/Bass xuống 15%, mở 100% Melody.
  * `[Acoustic Chill]`: Tắt Drums và Bass, chỉ giữ lại Vocals và Melody mộc mạc.
  * `[Drum & Bass]`: Tắt Vocals và Melody, giữ trọn vẹn dải trống và bass cho dân basshead.
  * `[Full Dynamic]`: Mở đầy đủ 4 kênh 100% nguyên bản.

---

### Phân hệ 3: Bộ Xử Lý Biến Thiên Thích Ứng (Dynamic Audio Engine)
* **FR-03.1 (Dynamic Lowpass Filter):** Cắt gọt dải tần nhịp trống và bass tự động theo chỉ số năng lượng $S_{energy} \in [0.0, 1.0]$:
  * Khi $S_{energy} \le 0.2$ (Tập trung sâu): Ép tần số cắt xuống $400\text{ Hz}$, biến tiếng trống sắc nhọn thành tiếng đập ấm trầm êm dịu dưới nền.
  * Khi $S_{energy} \to 1.0$ (Bùng nổ vận động): Mở rộng tần số cắt theo hàm số mũ lên $20.000\text{ Hz}$, bung trọn vẹn toàn dải âm thanh.
* **FR-03.2 (Chế độ Fallback Lo-Fi tức thời):** Đối với bài mới chưa có stems, hệ thống áp dụng bộ lọc EQ giả lập Lo-Fi Ambient ngay lập tức để người dùng nghe được ngay mà không phải chờ đợi.

---

### Phân hệ 4: Tầng Âm Thanh Bí Mật (Subliminal Focus Floor)
* **FR-04.1 (Sóng não Gamma 40Hz - Binaural Beats):** Tự sinh sóng stereo lệch tần số đúng 40Hz giữa 2 tai (ví dụ tai trái 200Hz, tai phải 240Hz). Đã được khoa học chứng minh giúp đưa não bộ vào trạng thái *Hyperfocus*.
* **FR-04.2 (Tiếng ồn Nâu - Brown Noise):** Tự sinh dải tiếng ồn nâu ấm áp bằng thuật toán lọc tích phân ngẫu nhiên (White Noise tích phân qua bộ lọc dốc $6\text{dB/octave}$). Triệt tiêu tạp âm văn phòng, tiếng người nói xung quanh.
* **FR-04.3 (Âm lượng ngầm 3%–5%):** Chạy ẩn dưới bài hát, tự động hòa quyện với giai điệu bài hát mà không gây chói gắt.

---

### Phân hệ 5: Không Gian Âm Thanh 8D Tự Xoay Quanh Não (Binaural Spatial 8D HRTF)
* **FR-05.1 (Mỏ neo nhịp điệu tâm - Phantom Center):** Ghim cố định **Drums & Bass** tại tâm `(0, 0, 0)` ngay giữa đỉnh đầu để giữ vững nhịp tim và thăng bằng tiền đình (không bị say/chóng mặt như các video 8D trên YouTube).
* **FR-05.2 (Quỹ đạo xoay 360° HRTF cho Melody):** Kênh Melody (`other`) được nối qua `PannerNode(panningModel: "HRTF")` lượn hình elip $360^\circ$ quanh đầu:
  $$x = 2.2 \sin(\theta), \quad z = -2.5 \cos(\theta), \quad y = 0.15 \sin(\theta)$$
* **FR-05.3 (3 Cấp tốc độ chu kỳ):** `45s Êm dịu` (thư thái sâu), `35s Chuẩn` (tỷ lệ vàng), `20s Bay bổng`.
* **FR-05.4 (2 Chế độ Vocal):** Cố định tâm (Deep Work) hoặc Đung đưa con lắc $\pm 15^\circ$ trước mặt như ca sĩ đứng trên sân khấu (Stage Ambience).

---

### Phân hệ 6: Chuyển Bài Thông Minh DJ Beat-Matched Crossfade
* **FR-06.1 (Tự động nhận diện Outro 15 giây):** Khi bài hát A còn 15 giây cuối, hệ thống tự động tải trước (preload) AudioBuffer của bài hát B.
* **FR-06.2 (Crossfade hòa âm 8.5 giây):**
  * Áp dụng bộ lọc Lowpass Sweep trên bài A hạ dần về dải trầm kèm Reverb Fade-out.
  * Đồng thời mở trước nhịp trống và giai điệu của bài B đè nhịp nhàng lên phần kết thúc bài A, tạo trải nghiệm chuyển bài liên tục như một set nhạc DJ phòng thu.

---

### Phân hệ 7: Nhận Diện Cuộc Họp Thông Minh (Meeting / Call Auto-Ducking)
* **FR-07.1 (Đo Decibel Client-side bảo mật 100%):** Bật micro nhẹ đo mức năng lượng RMS cục bộ trong trình duyệt. **Tuyệt đối không ghi âm, không truyền dữ liệu ra ngoài**.
* **FR-07.2 (Audio Ducking):** Khi bạn cất tiếng nói (trả lời sếp, mở mic họp Zoom/Meet/Teams), nhạc tự động hạ xuống **10% âm lượng**.
* **FR-07.3 (Khôi phục êm ái):** Sau khi ngừng nói trong **3.5 giây**, âm nhạc từ từ trồi lên mức bình thường. Không cần tìm nút Pause.

---

### Phân hệ 8: Nút Bùng Nổ Năng Lượng Khẩn Cấp (Emergency Drop Beat 15s)
* **FR-08.1 (Phím tắt toàn cục):** Bấm tổ hợp **`Ctrl + Alt + Space`** hoặc **`Ctrl + Shift + D`**.
* **FR-08.2 (15 Giây Ăn Mừng):** Toàn bộ 4 kênh âm thanh ngay lập tức bung 100% năng lượng, mở toàn dải âm thanh và kích hoạt Sub-bass rung tai trong đúng 15 giây (khi giải quyết xong bug khó, merge PR thành công), sau đó tự động hạ nhiệt về trạng thái tập trung sâu.

---

### Phân hệ 9: Thống Kê Hiệu Suất Làm Việc Dev-Wrapped (Flow State Analytics)
* **FR-09.1 (Bản đồ nhiệt GitHub-style):** Hiển thị các khối màu xanh lục thể hiện mật độ tập trung sâu theo từng khung giờ trong ngày.
* **FR-09.2 (Chỉ số năng suất):** Tổng số giờ đạt Flow State, số lần hệ thống hỗ trợ kích thích bass tỉnh táo (Fatigue Nudges), số lần bấm Drop Beat.
* **FR-09.3 (Bảng xếp hạng âm nhạc):** Top 3 bài hát giúp bạn đạt tốc độ gõ phím cao nhất (WPM peak).

---

### Phân hệ 10: Giao Diện Thị Giác 4-Stem Reactive Cyberpunk Visualizer (60fps LERP)
* **FR-10.1 (4 Vòng sóng âm Neon riêng biệt):**
  * 🔴 Drums: Đập nảy mạnh mẽ theo từng cú giậm Kick/Snare.
  * 🟣 Bass: Sóng trầm uốn lượn nhấp nhô dưới đáy.
  * 🟢 Melody: Vệt sóng ngọc lục bảo mượt mà thanh thoát.
  * 🔵 Vocals: Dải quang phổ cao trong suốt.
* **FR-10.2 (Thuật toán làm mượt LERP - Chống giật lag):** Áp dụng nội suy tuyến tính `smoothVal += (target - smoothVal) * 0.15` triệt tiêu hoàn toàn hiện tượng rung giật, duy trì 60 khung hình/giây mượt mà.
* **FR-10.3 (Vệ tinh 8D 🪐):** Vẽ chấm phát sáng Neon quay quanh vòng tròn FlowMeter tương ứng với góc xoay thực tế của giai điệu 8D trong không gian.

---

### Phân hệ 11: Quản Lý Playlists, Kéo-Thả & Sửa Tên Trực Tiếp (Inline Edit)
* **FR-11.1 (Đa danh sách phát):** Cho phép tạo nhiều playlist tùy chỉnh (Code đêm, Sáng tạo, Vận động nhẹ), gán bài hát linh hoạt.
* **FR-11.2 (Sắp xếp kéo-thả):** Dùng chuột kéo-thả hoặc bấm mũi tên Lên/Xuống để đổi thứ tự phát.
* **FR-11.3 (Sửa tên trực tiếp - Inline Edit):** Nhấp đúp vào tiêu đề bài hát hoặc bấm biểu tượng chiếc bút `[✏️]` để đổi tên hiển thị ngay tại chỗ (lưu qua `PUT /api/tracks/{id}/title`).
* **FR-11.4 (Chế độ phát):** Hỗ trợ Shuffle (Xáo trộn ngẫu nhiên bảo lưu danh sách gốc) và Repeat (Lặp toàn bộ / Lặp 1 bài / Không lặp).

---

## 4. KHUNG PHÁP LÝ, BẢN QUYỀN & MIỄN TRỪ TRÁCH NHIỆM

Hệ thống được thiết kế theo **Chiến Lược 4 Không (Zero-Liability & Zero-Cost Framework)**:
1. **Không Cloud Server Tách Nhạc:** Mọi tính toán AI diễn ra trên phần cứng cá nhân hoặc Colab cá nhân của người dùng.
2. **Không Lưu Trữ Nhạc Trên Mạng:** Stems và bài hát lưu 100% trên ổ cứng cục bộ của người dùng.
3. **Không Nhúng Sẵn yt-dlp:** Bộ cài thương mại không bundle sẵn binary `yt-dlp`. Người dùng bấm xác nhận hộp thoại [YtDlpConsentModal](file:///f:/A-PROJECTS/adaptive-music/frontend/src/components/YtDlpConsentModal.tsx) thì mới kích hoạt tại IP nhà riêng.
4. **Không Sở Hữu Bản Quyền Nhạc:** Định danh phần mềm là công cụ xử lý tín hiệu số (DSP Workstation & Player) theo mô hình BYOA.
5. **Tuân thủ Giấy phép Meta AI HTDemucs:** Lưu giữ nguyên vẹn giấy phép **MIT License** trong mục `[⚖️ PHÁP LÝ]` trên Header.
6. **Privacy by Design:** `activity_monitor.py` chỉ đếm số lượng xung cơ học (`event_count += 1`), tuyệt đối không đọc phím ký tự (No Keylogger), không quay màn hình.

---

## 5. ĐẶC TẢ YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

* **Hiệu năng & Tài nguyên:**
  * Trình phát nhạc chiếm không quá **1.5% CPU** và dưới **150MB RAM** khi phát nhạc thông thường.
  * Thời gian tải và giải mã 4 stems không quá **300ms** từ bộ nhớ đệm SSD.
* **Độ trễ chuyển đổi trạng thái (Transition Latency):**
  * Tốc độ phản hồi phím tắt Drop Beat dưới **50ms**.
  * Chuyển đổi giữa các mức năng lượng qua `linearRampToValueAtTime` êm dịu, không phát ra tiếng nổ lách tách (*audio pop/click*).
* **Độ tin cậy & Tương thích:**
  * Hoạt động ổn định trên Chrome, Edge, Brave, Firefox và các trình duyệt hỗ trợ Web Audio API hiện đại.
  * Hỗ trợ hệ điều hành Windows 10/11, macOS và Linux.

---

## 6. CẤU TRÚC THƯ MỤC & BẢN ĐỒ MÃ NGUỒN

```text
adaptive-music/
├── backend/
│   ├── main.py                     # FastAPI REST API & WebSocket Server
│   ├── audio_pipeline.py           # Quản lý tải yt-dlp, băm SHA-256 local, điều phối Colab/Demucs
│   ├── activity_monitor.py         # Lắng nghe nhịp gõ phím/chuột (No Keylogging)
│   ├── system_profiler.py          # Đo tải CPU, GPU, RAM máy tính
│   ├── requirements.txt            # Danh mục thư viện Python
│   └── cache_stems/                # BỘ NHỚ ĐỆM CỤC BỘ (Offline-First Storage)
│       ├── tracks.json             # Cơ sở dữ liệu danh mục bài hát
│       ├── playlists.json          # Cơ sở dữ liệu danh sách phát
│       ├── deleted_tracks.json     # Blacklist các bài đã xóa (chống hồi sinh khi sync)
│       └── {track_id}/             # Thư mục từng bài hát
│           ├── original.mp3        # File âm thanh gốc (192kbps)
│           ├── vocals.mp3          # Stem 1: Giọng hát (320kbps)
│           ├── other.mp3           # Stem 2: Melody / Piano / Synth (320kbps)
│           ├── bass.mp3            # Stem 3: Âm trầm Bass (320kbps)
│           └── drums.mp3           # Stem 4: Bộ gõ Drums (320kbps)
│
├── frontend/
│   ├── src/
│   │   ├── audio/
│   │   │   └── AdaptiveEngine.ts   # TRÁI TIM ÂM HỌC: Web Audio API, 4 Stems Mixing,
│   │   │                           # Binaural 8D HRTF, 40Hz Gamma & Brown Noise, DJ Crossfade
│   │   ├── components/
│   │   │   ├── ActiveStemMixer.tsx # Bàn trộn Fader 4 Kênh, Tầng Âm Bí Mật & Bảng Điều Khiển 8D
│   │   │   ├── FlowMeter.tsx       # Vòng tròn năng lượng & 4-Stem Cyberpunk Visualizer (60fps LERP)
│   │   │   ├── PlaylistView.tsx    # Quản lý Playlists, Dropzone File/Folder, Sửa tên inline [✏️]
│   │   │   ├── GeekHUD.tsx         # Thanh hiển thị chỉ số CPU/RAM, Mic Ducking, Nút Pháp Lý & Wrapped
│   │   │   ├── DevWrappedModal.tsx # Báo cáo năng suất Flow State & Bản đồ nhiệt GitHub-style
│   │   │   ├── LegalEulaModal.tsx  # Hộp thoại Điều khoản EULA & Meta HTDemucs MIT License
│   │   │   ├── YtDlpConsentModal.tsx # Hộp thoại xác nhận trích xuất âm thanh Decoupled yt-dlp
│   │   │   └── UploadQueuePanel.tsx# Bảng tiến trình nạp nhạc mini (Worker Pool Concurrency = 2)
│   │   ├── hooks/
│   │   │   ├── useDesktopSocket.ts # Kết nối WebSocket thời gian thực nhận nhịp gõ phím
│   │   │   ├── useMeetingDucking.ts# Lắng nghe âm lượng micro hạ nhạc tự động khi nói chuyện
│   │   │   └── useFlowAnalytics.ts # Thống kê giờ tập trung sâu & WPM peak
│   │   └── App.tsx                 # Điều phối trung tâm ứng dụng
│   ├── package.json
│   └── vite.config.ts
│
├── colab/
│   └── colab_stem_processor.ipynb  # Notebook Google Colab chạy GPU T4 tách 4 stems tự động
│
├── Comprehensive Commercialization & Operations Strategy.md # Tài liệu Chiến lược Thương mại hóa
└── SRS.md                          # Tài liệu Đặc tả Yêu cầu Kỹ thuật chuẩn (Tài liệu này)
```

---

*Tài liệu này được biên soạn nhằm đóng vai trò là kim chỉ nam kỹ thuật chuẩn xác và duy nhất, phản ánh trung thực 100% hiện trạng kiến trúc và các quyết định kỹ thuật của dự án Adaptive Flow & Beat Engine.*
