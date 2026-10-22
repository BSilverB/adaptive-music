import React from "react";
import { ShieldAlert, Check, FolderUp } from "lucide-react";

interface YtDlpConsentModalProps {
  isOpen: boolean;
  onConsent: () => void;
  onCancel: () => void;
}

export const YtDlpConsentModal: React.FC<YtDlpConsentModalProps> = ({
  isOpen,
  onConsent,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-950 p-6 shadow-[0_0_40px_rgba(245,158,11,0.2)] text-slate-200">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/60 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Xác Nhận Kích Hoạt Tiện Ích Trích Xuất (yt-dlp)
            </h3>
            <p className="text-[11px] text-amber-300/80 font-mono">
              DECOUPLED DEPENDENCY • BẢO MẬT & PHÁP LÝ
            </p>
          </div>
        </div>

        {/* Nội dung thông báo giải trình */}
        <div className="my-4 space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            Để trích xuất luồng âm thanh cá nhân từ liên kết trực tuyến phục vụ nghiên cứu và làm việc tập trung, ứng dụng sử dụng tiện ích mã nguồn mở <strong>yt-dlp</strong> (được phát hành theo giấy phép <em>The Unlicense - Public Domain</em>).
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <span>⚡ Cơ chế vận hành phân tán (Zero-Liability):</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              <li>Thao tác tải và giải mã diễn ra trực tiếp trên máy tính cá nhân của bạn.</li>
              <li>Nhà phát triển không lưu trữ, không trung chuyển và không thu thập bất kỳ dữ liệu âm thanh nào của bạn.</li>
            </ul>
          </div>

          <p className="text-[11px] text-slate-400">
            Bạn có đồng ý cho phép ứng dụng kích hoạt tiện ích này trên máy cục bộ của bạn không? Lựa chọn này sẽ được ghi nhớ cho các lần nạp liên kết tiếp theo.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-slate-800/80 pt-4">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
          >
            <FolderUp className="h-3.5 w-3.5" />
            <span>HỦY • DÙNG NHẠC MÁY (BYOA)</span>
          </button>

          <button
            onClick={onConsent}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg border border-amber-400 bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:bg-amber-400 transition-all active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span>TÔI ĐỒNG Ý & TIẾP TỤC</span>
          </button>
        </div>
      </div>
    </div>
  );
};
