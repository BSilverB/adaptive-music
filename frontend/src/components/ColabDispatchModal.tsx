import React, { useState, useRef } from "react";
import {
  Cloud,
  FolderOpen,
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Zap,
  FileArchive,
  RefreshCw,
} from "lucide-react";

interface ColabDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCount?: number;
  onOpenFolder: (folderType: "input_audio" | "sync_drive" | "cache_stems") => Promise<any>;
  onImportZip: (file: File) => Promise<{ success: boolean; message: string; count?: number }>;
  onForceSync?: () => Promise<void>;
}

export const ColabDispatchModal: React.FC<ColabDispatchModalProps> = ({
  isOpen,
  onClose,
  pendingCount = 0,
  onOpenFolder,
  onImportZip,
  onForceSync,
}) => {
  const [activeTab, setActiveTab] = useState<"direct_zip" | "drive_sync">("direct_zip");
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleOpenInputFolder = async () => {
    setIsOpeningFolder(true);
    try {
      await onOpenFolder("input_audio");
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const handleOpenColab = () => {
    // Mở notebook Colab chính thức trên GitHub hoặc Google Colab
    window.open(
      "https://colab.research.google.com/github/BSilverB/adaptive-music/blob/main/colab/colab_stem_processor.ipynb",
      "_blank"
    );
  };

  const handleFileProcess = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setImportStatus({
        type: "error",
        message: "Vui lòng chọn định dạng file .zip (ví dụ: Stems_Completed.zip do Colab xuất).",
      });
      return;
    }

    setIsImporting(true);
    setImportStatus(null);
    try {
      const res = await onImportZip(file);
      if (res.success) {
        setImportStatus({
          type: "success",
          message: res.message || `Đã nạp thành công các stems vào hệ thống!`,
        });
        if (onForceSync) await onForceSync();
      } else {
        setImportStatus({
          type: "error",
          message: res.message || "Không thể nạp file ZIP này. Hãy đảm bảo file chứa đủ 4 stems.",
        });
      }
    } catch (err: any) {
      setImportStatus({
        type: "error",
        message: err?.message || "Lỗi khi xử lý file ZIP.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-2xl shadow-cyan-950/40 text-slate-100 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Trung Tâm Tách Nhạc GPU Colab (Tesla T4)</span>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {pendingCount} bài đang chờ
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Mượn sức mạnh AI Cloud phân tách 4 Stems (320kbps) siêu tốc & hoàn toàn miễn phí
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("direct_zip")}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              activeTab === "direct_zip"
                ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileArchive className="h-4 w-4" />
            <span>Cách 1: Không cần Google Drive (Nạp File ZIP)</span>
          </button>
          <button
            onClick={() => setActiveTab("drive_sync")}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              activeTab === "drive_sync"
                ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Cách 2: Có Google Drive Desktop (Đồng bộ Tự động)</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "direct_zip" ? (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-slate-300 bg-slate-900/50 border border-slate-800 p-3 rounded-xl flex flex-col gap-2">
              <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> 3 Bước thực hiện nhanh:
              </span>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="text-cyan-400 font-bold block mb-1">Bước 1</span>
                  Bấm <b className="text-slate-200">Mở thư mục 01_Input_Audio</b> để lấy file nhạc cần tách.
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="text-cyan-400 font-bold block mb-1">Bước 2</span>
                  Bấm <b className="text-slate-200">Mở Colab</b>, tải các bài hát lên & chạy để nhận file ZIP.
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="text-cyan-400 font-bold block mb-1">Bước 3</span>
                  Kéo thả file <b className="text-slate-200">Stems_Completed.zip</b> vào ô bên dưới.
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenInputFolder}
                disabled={isOpeningFolder}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 py-2.5 px-3 text-xs font-semibold text-slate-200 transition-all shadow-sm"
              >
                {isOpeningFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                ) : (
                  <FolderOpen className="h-4 w-4 text-cyan-400" />
                )}
                <span>1. Mở thư mục 01_Input_Audio</span>
              </button>

              <button
                onClick={handleOpenColab}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 py-2.5 px-3 text-xs font-bold text-amber-300 transition-all shadow-sm group"
              >
                <ExternalLink className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span>2. Mở Google Colab T4 (Miễn phí)</span>
              </button>
            </div>

            {/* Dropzone for ZIP */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                isDragOver
                  ? "border-cyan-400 bg-cyan-950/30 scale-[1.01]"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await handleFileProcess(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />

              {isImporting ? (
                <div className="flex flex-col items-center gap-2 py-3">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-300">
                    Đang giải nén & nạp 4 stems vào hệ thống...
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      3. Kéo thả file Stems_Completed.zip vào đây
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Hoặc bấm để chọn file ZIP từ máy tính của bạn
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Import Status feedback */}
            {importStatus && (
              <div
                className={`flex items-center gap-2.5 rounded-xl p-3 text-xs font-medium border ${
                  importStatus.type === "success"
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                {importStatus.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-xs text-slate-300">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col gap-2.5">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Luồng tự động 2 chiều hoàn hảo:
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Khi bạn cài đặt phần mềm <b>Google Drive for Desktop</b>, thư mục{" "}
                <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded">AdaptiveMusic_Sync</code> sẽ
                đồng bộ tức thời. Khi bạn đưa nhạc vào App, nhạc tự động chuyển lên Drive; và khi Colab chạy
                xong, 4 Stems (320kbps) cùng <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded">metadata.json</code> sẽ tự động trở về máy tính của bạn!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenColab}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 px-3 text-xs font-bold transition-all shadow-md shadow-amber-500/20"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Mở Google Colab & Bấm "Run all"</span>
              </button>

              <button
                onClick={async () => {
                  if (onForceSync) await onForceSync();
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 py-2.5 px-4 text-xs font-semibold text-slate-200 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                <span>Đồng bộ ngay</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800/80 pt-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
