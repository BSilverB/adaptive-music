import React, { useState } from "react";
import { ShieldCheck, Scale, FileText, X, Check } from "lucide-react";

interface LegalEulaModalProps {
  isOpen: boolean;
  isFirstRun?: boolean;
  onAccept: () => void;
  onClose?: () => void;
}

export const LegalEulaModal: React.FC<LegalEulaModalProps> = ({
  isOpen,
  isFirstRun = false,
  onAccept,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"eula" | "licenses">("eula");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[88vh] rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-950/60 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                  Khung Pháp Lý & Điều Khoản Sử Dụng
                </h2>
                <span className="rounded bg-cyan-950 border border-cyan-500/30 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                  v1.0 COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tuyên bố bản quyền, chính sách bảo vệ đời tư & giấy phép mã nguồn mở
              </p>
            </div>
          </div>

          {!isFirstRun && onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 mt-4 border-b border-slate-800/80 pb-2 shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("eula")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === "eula"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Thỏa Thuận Người Dùng & Bản Quyền (EULA)</span>
          </button>
          <button
            onClick={() => setActiveTab("licenses")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              activeTab === "licenses"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Giấy Phép Bên Thứ Ba (Meta HTDemucs MIT)</span>
          </button>
        </div>

        {/* Nội dung cuộn được */}
        <div className="flex-1 overflow-y-auto pr-2 my-4 text-xs leading-relaxed text-slate-300 space-y-4 scrollbar-thin">
          {activeTab === "eula" ? (
            <>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5">
                <h4 className="font-bold text-cyan-300 uppercase tracking-wide mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  1. Bản chất Công cụ & Mô hình BYOA (Bring Your Own Audio)
                </h4>
                <p className="text-slate-300">
                  <strong>Adaptive Flow & Beat Engine</strong> là một ứng dụng trạm làm việc âm thanh kỹ thuật số cá nhân (Digital Signal Processing - DSP Workstation & Player).
                  Nhà phát triển phần mềm <strong>không sở hữu, không lưu trữ trên máy chủ đám mây, không cung cấp và không phân phối bất kỳ tệp hay nội dung âm nhạc nào</strong>.
                  Người dùng chịu trách nhiệm 100% đối với các tệp âm thanh và liên kết do chính mình nạp vào phần mềm.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
                <h4 className="font-bold text-slate-100 uppercase tracking-wide mb-1">
                  2. Trách nhiệm Bản quyền & Nguyên tắc Sử dụng Hợp lý (Fair Use)
                </h4>
                <p className="text-slate-400">
                  Người dùng cam kết chỉ sử dụng phần mềm đối với những nội dung âm thanh mà mình sở hữu quyền tác giả hợp pháp, đã được cấp phép sử dụng, hoặc nhằm mục đích nghiên cứu, học tập, rèn luyện khả năng tập trung cá nhân phi thương mại theo nguyên tắc Sử dụng Hợp lý (<em>Fair Use</em>).
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
                <h4 className="font-bold text-slate-100 uppercase tracking-wide mb-1">
                  3. Miễn trừ Trách nhiệm đối với Nền tảng Bên Thứ Ba (YouTube ToS)
                </h4>
                <p className="text-slate-400">
                  Phần mềm hoàn toàn độc lập, không liên kết, không được tài trợ, ủy quyền hay chứng thực bởi YouTube, Google LLC hay bất kỳ công ty liên kết nào. Tiện ích trích xuất nếu được kích hoạt sẽ thực thi hoàn toàn cục bộ trên máy và địa chỉ IP cá nhân của người dùng cuối.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5">
                <h4 className="font-bold text-emerald-300 uppercase tracking-wide mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  4. Cam kết Bảo vệ Đời tư Tuyệt đối (Privacy by Design)
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>
                    <strong>Không Ghi Nhận Phím (No Keylogger):</strong> Module đo lường hoạt động chỉ đếm số lượng xung nhịp cơ học (<code className="text-cyan-400">event_count += 1</code>) trên chu kỳ 10 giây. Tuyệt đối không đọc ký tự, không lưu văn bản, không quét màn hình.
                  </li>
                  <li>
                    <strong>Bảo mật Micro / Hội thoại:</strong> Tính năng Meeting Ducking chỉ đo mức âm lượng Decibel tức thời ngay trên trình duyệt (client-side Web Audio). Tuyệt đối không ghi âm, không truyền tải âm thanh ra ngoài.
                  </li>
                  <li>
                    <strong>Lưu Trữ Cục Bộ (Local-First):</strong> Toàn bộ dữ liệu, danh sách phát và các stems đã tách được lưu trữ độc quyền trên ổ cứng máy tính cá nhân của bạn.
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* License 1: Demucs Meta AI */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-indigo-300 font-bold mb-2">
                  <span>META AI - HTDEMUCS MODEL (MIT LICENSE)</span>
                  <span className="text-[10px] text-slate-400">Copyright (c) Meta Platforms, Inc.</span>
                </div>
                <p className="text-slate-400 leading-normal">
                  Permission is hereby granted, free of charge, to any person obtaining a copy
                  of this software and associated documentation files (the "Software"), to deal
                  in the Software without restriction, including without limitation the rights
                  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                  copies of the Software, and to permit persons to whom the Software is
                  furnished to do so, subject to the following conditions:
                  <br /><br />
                  The above copyright notice and this permission notice shall be included in all
                  copies or substantial portions of the Software.
                  <br /><br />
                  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
                </p>
              </div>

              {/* License 2: yt-dlp */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-200 font-bold mb-2">
                  <span>YT-DLP (THE UNLICENSE - PUBLIC DOMAIN)</span>
                </div>
                <p className="text-slate-400 leading-normal">
                  This is free and unencumbered software released into the public domain.
                  Anyone is free to copy, modify, publish, use, compile, sell, or
                  distribute this software, either in source code form or as a compiled
                  binary, for any purpose, commercial or non-commercial, and by any means.
                </p>
              </div>

              {/* License 3: FFmpeg, PyTorch, React */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 font-mono text-[11px]">
                <div className="text-slate-200 font-bold mb-1.5">
                  CÁC THƯ VIỆN BỔ TRỢ KHÁC (OPEN SOURCE NOTICES)
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong>FFmpeg:</strong> Licensed under GNU Lesser General Public License (LGPL) version 2.1 or later.</li>
                  <li><strong>PyTorch:</strong> Copyright (c) 2016- Facebook, Inc. (BSD-style License).</li>
                  <li><strong>React & Web Audio API:</strong> Copyright (c) Meta Platforms, Inc. (MIT License).</li>
                  <li><strong>Librosa & PyDub:</strong> ISC / MIT Licenses.</li>
                  <li><strong>Lucide Icons:</strong> Copyright (c) Lucide Contributors (ISC License).</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 shrink-0">
          <span className="text-[11px] text-slate-500">
            {isFirstRun ? "Vui lòng chấp thuận để bắt đầu sử dụng" : "Đã chấp thuận điều khoản EULA v1.0"}
          </span>

          <div className="flex items-center gap-2">
            {!isFirstRun && onClose && (
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all"
              >
                Đóng
              </button>
            )}
            <button
              onClick={onAccept}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400 bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-400 transition-all active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>{isFirstRun ? "TÔI ĐỒNG Ý & BẮT ĐẦU SỬ DỤNG" : "ĐÃ HIỂU & TIẾP TỤC"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
