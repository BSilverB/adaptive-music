import React, { useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  Minimize2,
  Maximize2,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: "pending" | "reading" | "uploading" | "cache_hit" | "ready" | "error";
  progress: number; // 0 to 100
  errorMessage?: string;
}

interface UploadQueuePanelProps {
  queue: UploadItem[];
  onDismiss: () => void;
  onClearCompleted: () => void;
}

export const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  queue,
  onDismiss,
  onClearCompleted,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (queue.length === 0) return null;

  const total = queue.length;
  const completed = queue.filter(
    (item) => item.status === "ready" || item.status === "cache_hit"
  ).length;
  const inProgress = queue.filter(
    (item) => item.status === "uploading" || item.status === "reading"
  ).length;
  const errors = queue.filter((item) => item.status === "error").length;

  const overallPercent = Math.round((completed / total) * 100);
  const isAllDone = completed + errors === total;

  return (
    <div className="fixed bottom-24 right-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-cyan-500/40 bg-slate-950/95 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all duration-300">
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/50 bg-cyan-950/60 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <UploadCloud className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                NẠP THƯ VIỆN NHẠC
              </span>
              <span className="rounded bg-cyan-950 border border-cyan-500/30 px-1.5 py-0.2 font-mono text-[10px] text-cyan-300">
                {completed}/{total}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {isAllDone
                ? "Đã nạp xong toàn bộ tệp!"
                : `Đang xử lý ${inProgress} tệp song song (Tối đa 2)...`}
            </p>
          </div>
        </div>

        {/* Nút Thu nhỏ / Đóng */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title={isMinimized ? "Phóng to" : "Thu nhỏ"}
          >
            {isMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>
          {isAllDone && (
            <button
              onClick={onDismiss}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
              title="Đóng bảng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Thanh tiến trình tổng thể */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
          <span>Tiến trình hoàn tất</span>
          <span className="font-bold text-cyan-400">{overallPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* 3. Danh sách chi tiết từng file (khi không thu nhỏ) */}
      {!isMinimized && (
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {queue.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 text-xs transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="truncate max-w-[200px] font-medium text-slate-200" title={item.name}>
                  {item.name}
                </span>

                {/* Badge trạng thái */}
                {item.status === "cache_hit" && (
                  <span className="flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-300 shrink-0">
                    <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                    CACHE HIT
                  </span>
                )}
                {item.status === "ready" && (
                  <span className="flex items-center gap-1 rounded bg-teal-950/80 border border-teal-500/40 px-1.5 py-0.2 text-[9px] font-semibold text-teal-300 shrink-0">
                    <CheckCircle2 className="h-2.5 w-2.5 text-teal-400" />
                    SẴN SÀNG
                  </span>
                )}
                {item.status === "uploading" && (
                  <span className="flex items-center gap-1 rounded bg-cyan-950/80 border border-cyan-500/40 px-1.5 py-0.2 text-[9px] font-semibold text-cyan-300 shrink-0 animate-pulse">
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-cyan-400" />
                    {item.progress}%
                  </span>
                )}
                {item.status === "reading" && (
                  <span className="rounded bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-300 shrink-0">
                    BĂM SHA-256...
                  </span>
                )}
                {item.status === "pending" && (
                  <span className="flex items-center gap-1 rounded bg-slate-800/80 px-1.5 py-0.2 text-[9px] font-medium text-slate-400 shrink-0">
                    <Clock className="h-2.5 w-2.5" />
                    CHỜ ĐẾN LƯỢT
                  </span>
                )}
                {item.status === "error" && (
                  <span className="flex items-center gap-1 rounded bg-rose-950/80 border border-rose-500/40 px-1.5 py-0.2 text-[9px] font-semibold text-rose-300 shrink-0">
                    <AlertCircle className="h-2.5 w-2.5 text-rose-400" />
                    LỖI
                  </span>
                )}
              </div>

              {/* Progress bar riêng của file nếu đang nạp */}
              {item.status === "uploading" && (
                <div className="h-1 w-full overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {item.errorMessage && (
                <p className="text-[10px] text-rose-400 mt-1 truncate">
                  {item.errorMessage}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 4. Footer */}
      {isAllDone && (
        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
          <span className="text-[10px] text-emerald-400 font-semibold">
            ✓ Hoàn tất {completed} bài hát!
          </span>
          <button
            onClick={onClearCompleted}
            className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Dọn dẹp danh sách
          </button>
        </div>
      )}
    </div>
  );
};
