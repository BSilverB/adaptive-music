import React from "react";
import { Cpu, Zap, Cloud, CheckCircle2, AlertTriangle, Loader2, X, Terminal } from "lucide-react";
import type { AIEngineState } from "../hooks/useDesktopSocket";

interface AIEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiEngine?: AIEngineState;
  onStartInstall: () => Promise<void>;
  onSwitchToColab: () => void;
}

export const AIEngineModal: React.FC<AIEngineModalProps> = ({
  isOpen,
  onClose,
  aiEngine,
  onStartInstall,
  onSwitchToColab,
}) => {
  if (!isOpen) return null;

  const isInstalling = aiEngine?.install_state === "installing";
  const isReady = aiEngine?.installed || aiEngine?.install_state === "ready";
  const isFailed = aiEngine?.install_state === "failed";
  const hasNvidia = aiEngine?.has_nvidia;
  const gpuName = aiEngine?.gpu_name || "CPU Standard";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-800/80 bg-slate-950 p-6 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-slate-200">
        {/* Nút đóng */}
        {!isInstalling && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Tiêu đề & Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              {isReady
                ? "BỘ NÃO LOCAL AI SẴN SÀNG"
                : "THIẾT LẬP LOCAL AI ENGINE (DEMUCS)"}
            </h2>
            <p className="text-xs text-slate-400">
              Tách 4 Stems (Vocals, Drums, Bass, Other) trực tiếp bằng phần cứng máy
            </p>
          </div>
        </div>

        {/* Thông tin phần cứng phát hiện */}
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" /> Phần cứng phát hiện:
            </span>
            <span className="font-semibold text-white truncate max-w-[240px]">
              {gpuName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Chế độ xử lý:</span>
            {hasNvidia ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Zap className="h-3 w-3" /> GPU NVIDIA CUDA (Siêu Tốc ~20-30s/bài)
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <Cpu className="h-3 w-3" /> CPU Đa Luồng (Laptop ~5-8 phút/bài)
              </span>
            )}
          </div>
        </div>

        {/* Trạng thái 1: Đang Cài Đặt */}
        {isInstalling && (
          <div className="space-y-4 my-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-cyan-400 flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                {aiEngine?.install_message || "Đang thiết lập môi trường AI..."}
              </span>
              <span className="font-mono text-cyan-300">{aiEngine?.install_progress || 0}%</span>
            </div>

            {/* Thanh tiến trình Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                style={{ width: `${aiEngine?.install_progress || 0}%` }}
              />
            </div>

            {/* Terminal log mini */}
            {aiEngine?.recent_logs && aiEngine.recent_logs.length > 0 && (
              <div className="rounded-lg bg-black/60 border border-slate-800 p-2.5 font-mono text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1 text-slate-500 mb-1">
                  <Terminal className="h-3 w-3" /> Nhật ký cài đặt:
                </div>
                {aiEngine.recent_logs.map((log, idx) => (
                  <p key={idx} className="truncate text-slate-300">
                    &gt; {log}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trạng thái 2: Đã Cài Xong */}
        {isReady && !isInstalling && (
          <div className="my-5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-300">
              Môi trường Demucs AI đã sẵn sàng hoạt động!
            </p>
            <p className="text-xs text-slate-400">
              Từ bây giờ bạn có thể tách bất kỳ bài hát nào trực tiếp trên máy tính mà không cần kết nối mạng.
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              BẮT ĐẦU TÁCH NHẠC NGAY
            </button>
          </div>
        )}

        {/* Trạng thái 3: Chưa cài hoặc Thất bại */}
        {!isReady && !isInstalling && (
          <div className="space-y-4">
            {isFailed && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <span className="font-semibold">Quá trình cài đặt tự động gặp trục trặc:</span>
                  <p className="text-[11px] text-rose-400/90 mt-0.5">
                    {aiEngine?.install_message || "Không thể tự động tải qua pip. Vui lòng sử dụng Google Colab để tách nhanh."}
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn đang yêu cầu tách nhạc trực tiếp bằng phần cứng máy tính. Bạn có thể chọn 1 trong 2 phương án:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Lựa chọn 1: Cài đặt tự động */}
              <button
                onClick={onStartInstall}
                className="flex flex-col items-start justify-between rounded-xl border border-cyan-500/50 bg-cyan-950/30 hover:bg-cyan-900/40 p-3.5 text-left transition-all group shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                    <Zap className="h-3.5 w-3.5 text-cyan-400" />
                    Cài Đặt Tự Động (1-Click)
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                    Tải gói Demucs AI về máy. Chạy offline 100%, không cần tài khoản Google.
                  </p>
                </div>
                <span className="mt-3 inline-block rounded bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 group-hover:bg-cyan-400">
                  TIẾP TỤC &gt;
                </span>
              </button>

              {/* Lựa chọn 2: Chuyển sang Colab GPU */}
              <button
                onClick={() => {
                  onSwitchToColab();
                  onClose();
                }}
                className="flex flex-col items-start justify-between rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 p-3.5 text-left transition-all group"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 group-hover:text-amber-200">
                    <Cloud className="h-3.5 w-3.5 text-amber-400" />
                    Dùng Google Colab (Free)
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                    Không cần tải gì về máy. Tách siêu tốc 15s trên GPU đám mây của Google.
                  </p>
                </div>
                <span className="mt-3 inline-block rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950">
                  CHỌN COLAB &gt;
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
