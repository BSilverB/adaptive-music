# ADAPTIVE FLOW & BEAT ENGINE

## TÀI LIỆU CHIẾN LƯỢC THƯƠNG MẠI HÓA, PHÁP LÝ & HƯỚNG DẪN VẬN HÀNH

**Phiên bản:** Commercial Release v1.0

**Định vị:** Standalone Neuro-Focus Audio Workstation & Player (Phần mềm tối ưu trạng thái tập trung & thích ứng sinh học cá nhân)

**Kiến trúc:** Local-First Desktop App (Tauri + React + Web Audio API) & Zero-Cost Distributed Pipeline

## MỤC LỤC

1. [TỔNG QUAN & ĐỊNH VỊ SẢN PHẨM THƯƠNG MẠI](#1-tổng-quan--định-vị-sản-phẩm-thương-mại)

2. [TÍNH NĂNG CỐT LÕI & CƠ CHẾ ÂM THANH](#2-tính-năng-cốt-lõi--cơ-chế-âm-thanh)

3. [CHIẾN LƯỢC MIỄN TRỪ PHÁP LÝ & TRIỆT TIÊU CHI PHÍ SERVER](#3-chiến-lược-miễn-trừ-pháp-lý--triệt-tiêu-chi-phí-server)

4. [ĐIỀU KHOẢN DỊCH VỤ, BẢN QUYỀN & CHÍNH SÁCH BẢO MẬT](#4-điều-khoản-dịch-vụ-bản-quyền--chính-sách-bảo-mật)

5. [HƯỚNG DẪN SỬ DỤNG SẢN PHẨM (USER MANUAL)](#5-hướng-dẫn-sử-dụng-sản-phẩm-user-manual)

6. [MÔ HÌNH THƯƠNG MẠI HÓA & LỘ TRÌNH PHÁT HÀNH](#6-mô-hình-thương-mại-hóa--lộ-trình-phát-hành)

## 1. TỔNG QUAN & ĐỊNH VỊ SẢN PHẨM THƯƠNG MẠI

### 1.1. Tuyên ngôn Định vị (Positioning Statement)

* **Chúng ta KHÔNG bán âm nhạc:** Chúng ta không cạnh tranh với Spotify, Apple Music hay YouTube về kho bài hát hay các bảng xếp hạng thịnh hành.

* **Chúng ta bán GIẢI PHÁP TỐI ƯU HIỆU SUẤT TRÍ NÃO (Flow OS):** Cung cấp công cụ công nghệ giúp người dùng chuyển hóa những bản nhạc ruột của chính họ thành các tầng sóng âm thích ứng sinh học, hỗ trợ duy trì trạng thái tập trung sâu (*Deep Work*) và bùng nổ năng lượng (*Drop Beat/Kinetic Boost*) tức thì khi cần giải phóng mệt mỏi.

* **Mô hình cốt lõi:** **BYOA (Bring Your Own Audio)** – Người dùng làm chủ 100% dữ liệu đầu vào.

### 1.2. Giải quyết nghịch lý Deep Work

* Nhạc tập trung truyền thống (Lofi, Brain.fm, White Noise) thường đơn điệu, dễ gây buồn ngủ sau 45–60 phút và thiếu sự kích thích đột phá.

* Nhạc giải trí thịnh hành (Hot Hit) có ca từ và nhịp trống dồn dập, gây phân tán vùng ngôn ngữ của vỏ não khi đang viết mã hoặc đọc tài liệu.

* **Adaptive Flow Engine** dung hòa điều này: Gọt giũa bài hát yêu thích thành bản nhạc nền êm dịu khi làm việc, tự động dập nhịp trống thức tỉnh khi uể oải, và cho phép bung toàn bộ bản nhạc trong 15 giây ăn mừng (Git Push / Pomodoro Done) trước khi êm dịu trở lại.

## 2. TÍNH NĂNG CỐT LÕI & CƠ CHẾ ÂM THANH

### 2.1. Phân hệ Nhập Nhạc Độc Lập (Audio Ingestion)

1. **Nạp Tệp Cục Bộ (Local File Upload / Drag & Drop - BẮT BUỘC):**

   * Người dùng kéo thả trực tiếp các file `.mp3`, `.wav`, `.flac`, `.m4a` từ máy tính vào giao diện.

   * Tính toán băm mã tệp (SHA-256 Hash) để tạo ID định danh duy nhất.

   * Âm thanh được nạp trực tiếp vào Web Audio API mà không cần kết nối Internet.

2. **Nhập Luồng Qua Đường Dẫn (External Link Extraction via Decoupled yt-dlp):**

   * Người dùng dán URL bài hát từ YouTube.

   * Yêu cầu được xử lý cục bộ trên máy người dùng thông qua tiện ích mở rộng dòng lệnh (xem chi tiết tại Mục 3).

### 2.2. Bộ Điều Khiển Âm Thanh Chủ Động (Active 4-Stem Mixer)

Thay vì gộp cứng tĩnh, hệ thống giữ nguyên 4 stems độc lập:

* **Drums (Trống):** Khung nhịp tiết tấu, năng lượng chính.

* **Bass (Âm trầm):** Độ dày, ấm và chiều sâu giai điệu.

* **Other (Nhạc cụ / Melody):** Piano, Guitar, Synth – trục âm thanh nền tập trung.

* **Vocals (Giọng hát):** Dải âm thanh giọng người.

**Giao diện Mixer 4 Kênh:**

* Nút Mute (Bật/Tắt tức thì) và thanh trượt Fader (0% – 100%) cho từng kênh.

* **Preset 1-Click:**

  * `[Deep Focus]`: Tắt Vocals, giảm Drums/Bass, mở toàn bộ Melody.

  * `[Acoustic Chill]`: Tắt Drums/Bass, chỉ giữ Vocals và Melody.

  * \[Drum & Bass\]: Tắt vocals, melody giữ drum và bass

  * `[Full Dynamic]`: Mở đầy đủ 4 kênh 100%.

### 2.3. Bộ Xử Lý Tín Hiệu Thích Ứng (Dynamic Audio Engine)

* **Dynamic Lowpass Filter trên Drums & Bass:** Khi năng lượng tập trung ($S_{energy} \le 0.2$), tần số cắt được ép xuống dải trầm ($400\text{ Hz}$), triệt tiêu tiếng gõ sắc nhọn của hi-hat/snare. Khi chuyển sang vận động ($S_{energy} \to 1.0$), bộ lọc mở rộng theo hàm số mũ lên $20.000\text{ Hz}$, bung toàn dải âm thanh.

* **Khóa pha mẫu chuẩn xác (Sample-Accurate Sync 0ms):** 4 luồng âm thanh chạy chung một mốc thời gian `AudioContext.currentTime`, không bao giờ bị lệch nhịp.

* **Tầng Âm Bí Mật (Subliminal Focus Floor):**

  * Tùy chọn phát ngầm sóng não Gamma 40Hz (Binaural Beats) hoặc Tiếng ồn Nâu (Brown Noise) ở mức âm lượng 3%–5% dưới dải nền để cách âm môi trường văn phòng.

* **Binaural Spatial 8D Audio:**

  * Drums, Bass và Vocals được ghim cố định ở trục giữa đỉnh đầu (Phantom Center) để bảo vệ thăng bằng tiền đình.

  * Riêng kênh Melody xoay chậm $360^\circ$ quanh đầu (chu kỳ 35 giây/vòng) qua `PannerNode` HRTF, nới rộng không gian phòng làm việc.

## 3. CHIẾN LƯỢC MIỄN TRỪ PHÁP LÝ & TRIỆT TIÊU CHI PHÍ SERVER

Để vận hành bền vững mà không bị các hãng đĩa khởi kiện và không phải chịu gánh nặng tài chính, dự án tuân thủ nghiêm ngặt **Chiến lược 4 Không (Zero-Liability & Zero-Cost Framework)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CHIẾN LƯỢC PHÁP LÝ & CHI PHÍ 0 ĐỒNG                   │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Không Cloud Server Tách Nhạc │ Tách trên Local GPU hoặc Colab cá nhân │
│ 2. Không Lưu Trữ Nhạc Trên Mạng│ Stems lưu hoàn toàn trên ổ cứng User │
│ 3. Không Nhúng Sẵn yt-dlp      │ Người dùng tự quyết định tải về máy   │
│ 4. Không Sở Hữu Bản Quyền Nhạc │ Mô hình BYOA (Người dùng tự nạp nhạc) │
└────────────────────────────────┴───────────────────────────────────────┘

```

### 3.1. Tuân thủ Giấy phép Mô hình HTDemucs (Meta AI)

* **Bản quyền mã nguồn:** Mô hình `demucs` / `htdemucs` được Meta phát hành theo giấy phép **MIT License**.

* **Thực thi:**

  1. Sản phẩm giữ nguyên thông báo bản quyền (Copyright Notice) và toàn văn giấy phép MIT của Meta Platforms, Inc. trong mục `Settings > About > Third-Party Licenses`.

  2. Chúng tôi **KHÔNG cung cấp dịch vụ máy chủ tập trung (Hosted Cloud API)** thu tiền trên lượt tách của Demucs, tránh mọi ranh giới tranh chấp liên quan đến dữ liệu huấn luyện phi thương mại (MUSDB18-HQ).

  3. Mọi tính toán AI diễn ra cục bộ trên phần cứng của người dùng hoặc trong môi trường máy ảo nghiên cứu cá nhân (Google Colab) của chính người dùng.

### 3.2. Chiến lược Tách rời Tiện ích `yt-dlp` (Decoupled Dependency Strategy)

* Thư viện `yt-dlp` được phát hành theo giấy phép **The Unlicense (Public Domain)**, hoàn toàn tự do về mặt phần mềm.

* Để tránh vi phạm Điều khoản dịch vụ của YouTube (ToS) ở góc độ nhà phân phối:

  * Bộ cài Desktop App (`.exe` / `.dmg`) **tuyệt đối không chứa sẵn file thực thi `yt-dlp`**.

  * Khi người dùng nhập đường dẫn trực tuyến lần đầu, ứng dụng kích hoạt hộp thoại xác nhận:

    > *"Để trích xuất luồng âm thanh cá nhân, ứng dụng cần sử dụng tiện ích mã nguồn mở yt-dlp. Bạn có đồng ý cho phép ứng dụng tự động tải tiện ích này về thư mục dữ liệu cục bộ trên máy của bạn không?"*

  * Thao tác tải và thực thi bắt nguồn từ hành vi chủ động của người dùng cuối thông qua địa chỉ IP tại nhà của họ.

### 3.3. Mô hình Xử lý Tách Nhạc 3 Cấp Độ (Zero-Cost Hierarchy)

1. **Cấp độ 1: Tách tức thì bằng Web Audio EQ (Zero Hardware Requirement):**

   * Người dùng máy tính cấu hình văn phòng không cần card đồ họa vẫn sử dụng được ngay.

   * Áp dụng bộ lọc dải tần thời gian thực trực tiếp trên file gốc, không cần tách stems, tiêu tốn 0% GPU.

2. **Cấp độ 2: Local AI Separation (Cho máy có GPU rời / Apple Silicon):**

   * Tích hợp runtime chạy trực tiếp trên GPU máy người dùng (thông qua ONNX / LibTorch). Thời gian xử lý: 15–30 giây/bài.

3. **Cấp độ 3: Worker Google Colab Cá Nhân (Giải phóng phần cứng):**

   * Người dùng sử dụng tài khoản Google cá nhân mở Google Colab do chúng tôi cung cấp sẵn kịch bản.

   * Google cấp GPU T4 miễn phí cho tài khoản người dùng để phục vụ mục đích cá nhân.

   * Kết quả xuất vào thư mục Google Drive của họ và tự động đồng bộ xuống thư mục Desktop App. Chi phí máy chủ phía nhà phát triển: **0 USD**.

### 3.4. Lưu trữ Dữ liệu Cục Bộ (Local-First Storage)

* Toàn bộ 4 stems sau khi tách được lưu trữ độc quyền trong thư mục cục bộ của ứng dụng:

  * Windows: `%APPDATA%/AdaptiveFlowEngine/stems/{track_id}/`

  * macOS: `~/Library/Application Support/AdaptiveFlowEngine/stems/{track_id}/`

* Tốc độ truy xuất đạt ngưỡng mili-giây, không tiêu tốn băng thông Internet khi nghe lại và nhà phát triển không phải trả bất kỳ chi phí Cloud Storage nào.

## 4. ĐIỀU KHOẢN DỊCH VỤ, BẢN QUYỀN & CHÍNH SÁCH BẢO MẬT

*(Văn bản này được nhúng trực tiếp vào ứng dụng và hiển thị trong lần khởi chạy đầu tiên)*

### 4.1. Thỏa thuận Giấy phép Người dùng Cuối (EULA) & Tuyên bố Bản quyền

1. **Bản chất Công cụ:** *Adaptive Flow & Beat Engine* là phần mềm đa phương tiện cá nhân, hoạt động như một bộ xử lý tín hiệu âm thanh kỹ thuật số (DSP) và trình phát cục bộ. Nhà phát triển không sở hữu, không lưu trữ, không cung cấp và không phân phối bất kỳ nội dung âm nhạc nào.

2. **Trách nhiệm Nội dung:** Người dùng hoàn toàn chịu trách nhiệm về tính pháp lý và bản quyền của mọi tệp âm thanh hoặc đường dẫn liên kết được nạp vào phần mềm. Người dùng cam kết chỉ sử dụng các nội dung mà mình sở hữu quyền tác giả, có giấy phép sử dụng hợp pháp, hoặc phục vụ mục đích nghiên cứu, học tập cá nhân theo nguyên tắc Sử dụng Hợp lý (*Fair Use*).

3. **Miễn trừ Trách nhiệm YouTube:** Phần mềm không liên kết, không được ủy quyền, tài trợ hoặc chứng thực bởi YouTube, Google LLC hay bất kỳ công ty con nào. Người dùng chịu trách nhiệm tuân thủ Điều khoản Dịch vụ của các nền tảng bên thứ ba mà họ truy cập.

### 4.2. Chính sách Bảo mật Tuyệt đối (Privacy by Design)

* **Bảo mật Thao tác Phím/Chuột:** Module đo lường năng suất làm việc chỉ thực hiện đếm số lượng xung nhịp cơ học (`event_count += 1`) trên mỗi chu kỳ 10 giây. Phần mềm **tuyệt đối không ghi nhận mã ký tự (No Keylogging), không lưu nội dung văn bản, không quét lịch sử duyệt web**.

* **Bảo mật Camera (Webcam Kinetic Mode):** Luồng hình ảnh từ webcam được đưa trực tiếp vào bộ nhớ tạm (RAM) để mô hình MediaPipe trích xuất tọa độ khung xương dưới dạng các điểm ảnh trừu tượng $(x, y)$. **Phần mềm không chụp ảnh, không quay video, không lưu trữ tệp hình ảnh và không truyền dữ liệu hình ảnh ra khỏi máy tính**.

* **Không Thu thập Thông tin Nhận dạng:** Ứng dụng không yêu cầu đăng ký tài khoản định danh, không gửi dữ liệu âm thanh cá nhân về bất kỳ máy chủ nào.

## 5. HƯỚNG DẪN SỬ DỤNG SẢN PHẨM (USER MANUAL)

### 5.1. Cài đặt Ứng dụng

1. Tải bộ cài đặt tương ứng với hệ điều hành:

   * Windows: `AdaptiveFlowEngine-Setup-x64.exe`

   * macOS: `AdaptiveFlowEngine-Universal.dmg`

2. Tiến hành cài đặt theo hướng dẫn trên màn hình. Mở ứng dụng từ Desktop hoặc Menu Bar.

### 5.2. Hướng dẫn Nạp Nhạc vào Thư Viện

#### Cách 1: Tự Nạp File Từ Máy Tính (Khuyên dùng - Nhanh & Chất lượng tốt nhất)

1. Trên giao diện chính, bấm vào khu vực **`[+ Thêm Nhạc]`** hoặc kéo thả trực tiếp tệp âm thanh (`.mp3`, `.wav`, `.flac`) từ thư mục máy tính vào cửa sổ ứng dụng.

2. Bản nhạc sẽ xuất hiện ngay trong danh sách phát với nhãn `🟢 GỐC (SẴN SÀNG)`.

3. Bạn có thể nhấn phát ngay lập tức. Hệ thống sẽ áp dụng bộ lọc thích ứng *Web Audio EQ Morphing* theo thời gian thực mà không cần chờ đợi.

#### Cách 2: Dán Đường Dẫn Trực Tuyến

1. Sao chép liên kết video bài hát bạn muốn nghe.

2. Dán vào thanh nhập URL và bấm biểu tượng tải `[⬇️]`.

3. Lần đầu tiên sử dụng, chọn **`[Đồng ý]`** khi ứng dụng hỏi về việc tải tiện ích bổ trợ `yt-dlp`. Bản nhạc sau khi tải về sẽ được lưu trữ an toàn trong thư viện máy bạn.

### 5.3. Quy trình Tách Lớp 4-Stems Bằng Google Colab (Không tốn phần cứng)

Để sử dụng bàn trộn âm thanh 4 kênh và hiệu ứng không gian 8D chuyên sâu cho các máy tính mỏng nhẹ:

1. Nhấn nút **`[☁️ Mở Google Colab]`** trên thanh điều khiển.

2. Trình duyệt mở ra Notebook mẫu được cấu hình sẵn. Bấm menu **`Runtime > Run all`** (hoặc `Ctrl + F9`).

3. Đăng nhập tài khoản Google Drive của bạn khi được yêu cầu cấp quyền lưu file.

4. GPU T4 của Google sẽ tự động đọc các bài hát trong hàng đợi, tách thành 4 stems độc lập (`drums.wav`, `bass.wav`, `other.wav`, `vocals.wav`) và chuyển về thư mục `AdaptiveMusic_Sync/03_Output_Stems/`.

5. Trên Desktop App, nhấn nút **`[🔄 Force Sync]`**. Ứng dụng tự động phát hiện các stems mới và chuyển trạng thái sang `🟢 4 STEMS CHUẨN STUDIO`.

### 5.4. Vận Hành Trong Giờ Làm Việc

* **Chế độ Deep Work (Tự động):** Chỉ cần đeo tai nghe và viết mã. Nhạc tự động ẩn tiếng hát, lọc êm tiếng trống để bạn tập trung.

* **Kích hoạt Bùng Nổ Khẩn Cấp (Emergency Drop Beat):**

  * Bấm tổ hợp phím tắt: **`Ctrl + Alt + Space`** (hoặc `Cmd + Option + Space` trên Mac).

  * Toàn bộ 4 kênh âm thanh lập tức bung 100% năng lượng dải tần và kích hoạt Sub-bass trong đúng **15 giây** để bạn ăn mừng thành quả (hoàn thành bug, merge PR), sau đó tự động hạ nhiệt êm dịu về trạng thái tĩnh lặng.

* **Sử dụng Bàn Trộn Chủ Động (Active Mixer):** Nhấp vào biểu tượng Mixer ở góc phải để tự tay gạt tắt/bật từng dải âm thanh theo sở thích cá nhân.

* **Xem Báo Cáo Năng Suất (Dev-Wrapped):** Nhấp biểu tượng `[📊]` trên Header vào cuối ngày để xem tổng số giờ tập trung sâu, bản đồ nhiệt năng suất GitHub-style và danh sách các bài hát giúp bạn đạt tốc độ gõ phím cao nhất.

## 6. MÔ HÌNH THƯƠNG MẠI HÓA & LỘ TRÌNH PHÁT HÀNH

### 6.1. Chiến Lược Doanh Thu (Monetization Strategy)

Vì chi phí vận hành máy chủ là **0 USD**, sản phẩm có biên lợi nhuận ròng cực cao:

* **Mô hình Trả phí Một lần (Pay-Once Lifetime License):**

  * Giá đề xuất: **\$19 – $29 / trọn đời** (Bao gồm cập nhật 1 năm).

  * Khách hàng là lập trình viên, nhà thiết kế, người làm việc sáng tạo rất ưa chuộng mô hình mua đứt không đăng ký thuê bao định kỳ.

* **Bản Miễn phí Giới hạn (Free Community Edition):**

  * Sử dụng không giới hạn tính năng phát nhạc và bộ lọc EQ thích ứng thời gian thực (Web Audio EQ Morphing).

  * Giới hạn tính năng 4-Stem Active Mixer và 8D Spatial Audio ở 5 bài hát đầu tiên để kích thích nâng cấp bản quyền Pro.

### 6.2. Các Kênh Phân Phối Tiếp Thị (Go-To-Market)

1. **GitHub Releases & Trang chủ Chính thức:** Phân phối file cài đặt trực tiếp, hoàn toàn độc lập và không chịu kiểm duyệt của bên thứ ba.

2. **Cộng đồng Kỹ thuật & Hiệu suất:** Tiếp thị trên các diễn đàn Product Hunt, Hacker News, Reddit (`r/programming`, `r/lofi`, `r/productivity`).

3. **Thông điệp Tiếp thị Cốt lõi:**

   > *"Đừng đổi danh sách bài hát của bạn. Hãy biến những bài hát bạn yêu thích thành một công cụ kích hoạt trạng thái tập trung sâu và bảo vệ nhịp độ sinh học khi lập trình."*

*Tài liệu này đóng vai trò là kim chỉ nam toàn diện về kỹ thuật, pháp lý và vận hành thương mại cho toàn bộ dự án Adaptive Flow & Beat Engine.*