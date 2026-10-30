import React, { useState } from "react";
import { Sparkles, Download, CheckCircle2, ExternalLink, X, RefreshCw, ArrowRight, Shield } from "lucide-react";
import type { UpdateInfo } from "../services/updateChecker";

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  checking: boolean;
  onRecheck: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  checking,
  onRecheck,
}) => {
  const [downloadStarted, setDownloadStarted] = useState(false);

  if (!isOpen) return null;

  const hasUpdate = updateInfo?.hasUpdate;

  const handleDownloadNow = () => {
    if (updateInfo?.downloadUrl) {
      setDownloadStarted(true);
      window.open(updateInfo.downloadUrl, "_blank");
    }
  };

  const handleDownloadPortable = () => {
    if (updateInfo?.portableUrl) {
      window.open(updateInfo.portableUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-[#0b101b] p-6 shadow-2xl shadow-cyan-500/20 glow-cyan">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 p-[1px]">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#090d16]">
              {hasUpdate ? (
                <Sparkles className="h-5 w-5 text-cyan-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {hasUpdate ? "Bản Cập Nhật Mới Đã Sẵn Sàng" : "Hệ Thống Đã Được Cập Nhật"}
            </h2>
            <p className="text-xs text-slate-400">
              {hasUpdate
                ? "Nâng cấp để nhận những cải tiến hiệu suất và tính năng mới nhất"
                : "Bạn đang sử dụng phiên bản tối ưu và ổn định nhất của Adaptive Flow"}
            </p>
          </div>
        </div>

        {/* Version Badge Box */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs mb-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Phiên bản hiện tại:</span>
            <span className="font-bold text-slate-200">v{updateInfo?.currentVersion || "1.0.2"}</span>
          </div>

          {hasUpdate ? (
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                v{updateInfo?.latestVersion}
              </span>
            </div>
          ) : (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mới nhất
            </span>
          )}
        </div>

        {/* Changelog Content */}
        {hasUpdate ? (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-cyan-400" /> Điểm mới trong bản này:
              </span>
              {updateInfo?.publishedAt && <span>Phát hành: {updateInfo.publishedAt}</span>}
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300 leading-relaxed font-sans space-y-2.5">
              {updateInfo?.releaseNotes ? (
                updateInfo.releaseNotes.split("\n").map((line, idx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith("#")) {
                    return (
                      <p key={idx} className="font-bold text-cyan-300 pt-1">
                        {trimmed.replace(/^#+\s*/, "")}
                      </p>
                    );
                  }
                  if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
                    return (
                      <div key={idx} className="flex items-start gap-2 text-slate-300">
                        <span className="text-cyan-400 font-bold">•</span>
                        <span>{trimmed.replace(/^[-*]\s*/, "")}</span>
                      </div>
                    );
                  }
                  return <p key={idx}>{trimmed}</p>;
                })
              ) : (
                <p>Bản cập nhật cải thiện tính năng phân tách 4-stems, tự động nhận diện phần cứng và sửa các lỗi phát sinh.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 space-y-2 mb-4">
            <p>Hệ thống tự động đồng bộ liên tục với kho phát hành chính thức trên GitHub.</p>
            <p className="text-[11px] text-slate-500">Mọi bài hát và mô hình AI của bạn đang hoạt động ở trạng thái tốt nhất.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={onRecheck}
            disabled={checking}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin text-cyan-400" : ""}`} />
            <span>{checking ? "Đang kiểm tra..." : "Kiểm tra lại"}</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              {hasUpdate ? "Để Sau" : "Đóng"}
            </button>

            {hasUpdate && (
              <button
                onClick={handleDownloadNow}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>{downloadStarted ? "Đang Mở Tải Về..." : "Cập Nhật Ngay (Bản Setup)"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Portable alternative link */}
        {hasUpdate && updateInfo?.portableUrl && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <span>Bạn dùng bản không cần cài đặt?</span>
            <button
              onClick={handleDownloadPortable}
              className="text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer transition-colors"
            >
              Tải Bản Portable (.exe)
            </button>
          </div>
        )}

        {/* GitHub link */}
        {updateInfo?.htmlUrl && (
          <div className="mt-2 text-center">
            <a
              href={updateInfo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400 transition-colors"
            >
              <span>Xem chi tiết bản phát hành trên GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
