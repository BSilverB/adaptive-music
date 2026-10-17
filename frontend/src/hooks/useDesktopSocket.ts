import { useState, useEffect, useRef, useCallback } from "react";
import { adaptiveEngine } from "../audio/AdaptiveEngine";

export interface ActivityState {
  idle_seconds: number;
  energy_level: number;
  state: "DEEP_FOCUS" | "THINKING" | "FATIGUE_NUDGE" | "MANUAL_BURST" | "BREAK_TIME";
  auto_fatigue_enabled: boolean;
  pomodoro: {
    elapsed_seconds: number;
    in_break: boolean;
  };
}

export interface SystemState {
  cpu_percent: number;
  ram_used_mb: number;
  ram_percent: number;
}

export interface QueueState {
  queue_size: number;
  current_job: string | null;
  device: string;
  engine_mode: "COLAB_BATCH" | "LOCAL";
  pending_colab_count: number;
  drive_sync_dir: string;
}

export function useDesktopSocket() {
  const [connected, setConnected] = useState<boolean>(false);
  const [activity, setActivity] = useState<ActivityState>({
    idle_seconds: 0,
    energy_level: 0.0,
    state: "DEEP_FOCUS",
    auto_fatigue_enabled: true,
    pomodoro: { elapsed_seconds: 0, in_break: false }
  });
  const [system, setSystem] = useState<SystemState>({
    cpu_percent: 0,
    ram_used_mb: 0,
    ram_percent: 0
  });
  const [queue, setQueue] = useState<QueueState>({
    queue_size: 0,
    current_job: null,
    device: "cpu",
    engine_mode: "COLAB_BATCH",
    pending_colab_count: 0,
    drive_sync_dir: ""
  });
  const [tracksCount, setTracksCount] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const connect = useCallback(async () => {
    try {
      // 1. Lấy session token bảo mật
      const tokenResp = await fetch("http://127.0.0.1:8000/api/auth/token");
      if (!tokenResp.ok) throw new Error("Không lấy được token");
      const { token } = await tokenResp.json();

      // 2. Khởi tạo kết nối WebSocket với token
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.activity) {
            setActivity(data.activity);
            // Đồng bộ năng lượng vào audio engine với thời gian chuyển tiếp mượt mà
            adaptiveEngine.setEnergy(data.activity.energy_level, 1.2);
          }
          if (data.system) {
            setSystem(data.system);
          }
          if (data.queue) {
            setQueue(data.queue);
          }
          if (data.tracks_count !== undefined) {
            setTracksCount(data.tracks_count);
          }
        } catch {
          // Bỏ qua lỗi parse
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Tự động kết nối lại sau 2 giây
        reconnectTimer.current = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
      reconnectTimer.current = window.setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const triggerBurst = async (durationSec: number = 30) => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "BURST", duration: durationSec }));
      } else {
        await fetch("http://127.0.0.1:8000/api/controls/burst", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration_seconds: durationSec })
        });
      }
    } catch (e) {
      console.error("Lỗi kích hoạt Burst:", e);
    }
  };

  const toggleAutoFatigue = async (enabled: boolean) => {
    try {
      await fetch("http://127.0.0.1:8000/api/controls/auto-fatigue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
    } catch (e) {
      console.error("Lỗi cập nhật Auto-Fatigue:", e);
    }
  };

  const forceSyncDrive = async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/sync/check-drive", {
        method: "POST"
      });
      return await resp.json();
    } catch (e) {
      console.error("Lỗi Force Sync Drive:", e);
      return null;
    }
  };

  const setEngineMode = async (mode: "COLAB_BATCH" | "LOCAL") => {
    try {
      await fetch("http://127.0.0.1:8000/api/settings/engine-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
    } catch (e) {
      console.error("Lỗi đổi Engine Mode:", e);
    }
  };

  return {
    connected,
    activity,
    system,
    queue,
    tracksCount,
    triggerBurst,
    toggleAutoFatigue,
    forceSyncDrive,
    setEngineMode
  };
}
