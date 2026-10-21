import { useState, useEffect, useRef, useCallback } from "react";
import { adaptiveEngine } from "../audio/AdaptiveEngine";

export function useMeetingDucking() {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("adaptive_mic_ducking_enabled") === "true";
    } catch {
      return false;
    }
  });

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechLevel, setSpeechLevel] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);

  const stopMic = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => { /* ignore */ });
      audioCtxRef.current = null;
    }
    setIsSpeaking(false);
    setSpeechLevel(0);
    adaptiveEngine.setDucking(false);
  }, []);

  const startMic = useCallback(async () => {
    stopMic();
    setMicError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ truy cập Micro.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      intervalRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalizedLevel = Math.min(1.0, rms * 5.0);
        setSpeechLevel(normalizedLevel);

        const now = Date.now();
        // Ngưỡng phát hiện giọng nói (Voice threshold RMS ~ 0.038)
        if (rms > 0.038) {
          lastSpeechTimeRef.current = now;
          setIsSpeaking(true);
          adaptiveEngine.setDucking(true);
        } else {
          // Khi im lặng vượt quá 3.5 giây -> Hồi phục âm nhạc
          if (now - lastSpeechTimeRef.current > 3500) {
            setIsSpeaking((prev) => {
              if (prev) {
                adaptiveEngine.setDucking(false);
                return false;
              }
              return false;
            });
          }
        }
      }, 90);

      return true;
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Không thể truy cập Micro";
      setMicError(errorMsg);
      stopMic();
      setIsEnabled(false);
      try {
        localStorage.setItem("adaptive_mic_ducking_enabled", "false");
      } catch { /* ignore */ }
      return false;
    }
  }, [stopMic]);

  // Khởi động hoặc dừng khi isEnabled thay đổi
  useEffect(() => {
    if (isEnabled) {
      startMic();
    } else {
      stopMic();
    }
    return () => {
      stopMic();
    };
  }, [isEnabled, startMic, stopMic]);

  const toggleMicDucking = async () => {
    const nextVal = !isEnabled;
    setIsEnabled(nextVal);
    try {
      localStorage.setItem("adaptive_mic_ducking_enabled", nextVal.toString());
    } catch { /* ignore */ }
  };

  return {
    isEnabled,
    isSpeaking,
    speechLevel,
    micError,
    toggleMicDucking,
  };
}
