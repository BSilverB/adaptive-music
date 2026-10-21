import { useState, useEffect, useRef, useCallback } from "react";
import type { ActivityState } from "./useDesktopSocket";
import type { TrackMeta } from "../audio/AdaptiveEngine";

export interface DailyFlowStats {
  date: string; // YYYY-MM-DD
  totalListeningSeconds: number;
  deepFocusSeconds: number;
  fatigueNudgeCount: number;
  manualBurstCount: number;
  trackPlays: Record<string, { title: string; seconds: number }>;
}

const STORAGE_KEY = "adaptive_flow_analytics_v1";

function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadAllStats(): Record<string, DailyFlowStats> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}

function saveAllStats(stats: Record<string, DailyFlowStats>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function useFlowAnalytics(
  isPlaying: boolean,
  currentTrack: TrackMeta | null,
  activity: ActivityState
) {
  const [allStats, setAllStats] = useState<Record<string, DailyFlowStats>>(() => {
    return loadAllStats();
  });

  const todayKey = getTodayKey();
  const prevActivityStateRef = useRef<string>(activity.state);

  // Khởi tạo stats hôm nay nếu chưa có
  const todayStats: DailyFlowStats = allStats[todayKey] || {
    date: todayKey,
    totalListeningSeconds: 0,
    deepFocusSeconds: 0,
    fatigueNudgeCount: 0,
    manualBurstCount: 0,
    trackPlays: {},
  };

  // 1. Lắng nghe chuyển trạng thái Fatigue Nudge hoặc Manual Burst để đếm sự kiện
  useEffect(() => {
    const prevState = prevActivityStateRef.current;
    const currState = activity.state;

    if (prevState !== currState) {
      setAllStats((prev) => {
        const currentToday = prev[todayKey] || {
          date: todayKey,
          totalListeningSeconds: 0,
          deepFocusSeconds: 0,
          fatigueNudgeCount: 0,
          manualBurstCount: 0,
          trackPlays: {},
        };

        let updated = false;
        const nextToday = { ...currentToday };

        if (currState === "FATIGUE_NUDGE" && prevState !== "FATIGUE_NUDGE") {
          nextToday.fatigueNudgeCount += 1;
          updated = true;
        } else if (currState === "MANUAL_BURST" && prevState !== "MANUAL_BURST") {
          nextToday.manualBurstCount += 1;
          updated = true;
        }

        if (updated) {
          const nextAll = { ...prev, [todayKey]: nextToday };
          saveAllStats(nextAll);
          return nextAll;
        }
        return prev;
      });

      prevActivityStateRef.current = currState;
    }
  }, [activity.state, todayKey]);

  // 2. Nhịp đếm mỗi giây khi đang phát nhạc để tích lũy thời gian
  useEffect(() => {
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      setAllStats((prev) => {
        const currentToday = prev[todayKey] || {
          date: todayKey,
          totalListeningSeconds: 0,
          deepFocusSeconds: 0,
          fatigueNudgeCount: 0,
          manualBurstCount: 0,
          trackPlays: {},
        };

        const isDeepFocus = activity.energy_level < 0.2 && activity.state === "DEEP_FOCUS";
        const nextToday: DailyFlowStats = {
          ...currentToday,
          totalListeningSeconds: currentToday.totalListeningSeconds + 1,
          deepFocusSeconds: isDeepFocus
            ? currentToday.deepFocusSeconds + 1
            : currentToday.deepFocusSeconds,
          trackPlays: { ...currentToday.trackPlays },
        };

        if (currentTrack) {
          const prevTrackData = nextToday.trackPlays[currentTrack.id] || {
            title: currentTrack.title,
            seconds: 0,
          };
          nextToday.trackPlays[currentTrack.id] = {
            title: currentTrack.title,
            seconds: prevTrackData.seconds + 1,
          };
        }

        // Lưu lại mỗi 5 giây vào localStorage
        if (nextToday.totalListeningSeconds % 5 === 0) {
          saveAllStats({ ...prev, [todayKey]: nextToday });
        }

        return { ...prev, [todayKey]: nextToday };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, activity.energy_level, activity.state, todayKey]);

  // Top bài hát trong ngày
  const topTracks = Object.entries(todayStats.trackPlays || {})
    .map(([id, data]) => ({
      id,
      title: data.title,
      seconds: data.seconds,
      minutes: Math.round(data.seconds / 60),
    }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  // Tỉ lệ Hyperfocus Flow %
  const flowRatio =
    todayStats.totalListeningSeconds > 0
      ? Math.round(
          (todayStats.deepFocusSeconds / todayStats.totalListeningSeconds) * 100
        )
      : 100;

  const resetTodayStats = useCallback(() => {
    setAllStats((prev) => {
      const nextAll = {
        ...prev,
        [todayKey]: {
          date: todayKey,
          totalListeningSeconds: 0,
          deepFocusSeconds: 0,
          fatigueNudgeCount: 0,
          manualBurstCount: 0,
          trackPlays: {},
        },
      };
      saveAllStats(nextAll);
      return nextAll;
    });
  }, [todayKey]);

  return {
    todayStats,
    allStats,
    topTracks,
    flowRatio,
    resetTodayStats,
  };
}
