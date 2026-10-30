export const APP_VERSION = "1.0.4";

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;       // Bản Setup mặc định (.exe)
  portableUrl?: string;      // Bản Portable tùy chọn (.exe)
  htmlUrl: string;
}

// Hàm so sánh 2 chuỗi version dạng semver (vd: "1.0.4" vs "1.0.3")
export function isNewerVersion(latest: string, current: string): boolean {
  const clean = (v: string) => v.replace(/^v/, "").trim();
  const v1Parts = clean(latest).split(".").map(Number);
  const v2Parts = clean(current).split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const num1 = v1Parts[i] || 0;
    const num2 = v2Parts[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}

export async function checkGitHubUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch("https://api.github.com/repos/BSilverB/adaptive-music/releases/latest", {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const latestTag = data.tag_name || "";
    const cleanLatest = latestTag.replace(/^v/, "");
    const hasUpdate = isNewerVersion(cleanLatest, APP_VERSION);

    // Mặc định URL dự phòng
    let setupDownloadUrl = `https://github.com/BSilverB/adaptive-music/releases/download/${latestTag}/Adaptive-Flow-Engine-Setup-${cleanLatest}.exe`;
    let portableDownloadUrl = `https://github.com/BSilverB/adaptive-music/releases/download/${latestTag}/Adaptive-Flow-Engine-${cleanLatest}.exe`;

    if (Array.isArray(data.assets)) {
      // 1. ƯU TIÊN TUYỆT ĐỐI BẢN SETUP (chứa chữ 'setup' và đuôi '.exe')
      const setupAsset = data.assets.find((a: any) =>
        a.name && a.name.toLowerCase().includes("setup") && a.name.toLowerCase().endsWith(".exe")
      );
      if (setupAsset && setupAsset.browser_download_url) {
        setupDownloadUrl = setupAsset.browser_download_url;
      }

      // 2. Tìm bản Portable (đuôi '.exe' nhưng không chứa 'setup')
      const portableAsset = data.assets.find((a: any) =>
        a.name && !a.name.toLowerCase().includes("setup") && a.name.toLowerCase().endsWith(".exe")
      );
      if (portableAsset && portableAsset.browser_download_url) {
        portableDownloadUrl = portableAsset.browser_download_url;
      }
    }

    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: cleanLatest,
      releaseName: data.name || `Phiên bản ${latestTag}`,
      releaseNotes: data.body || "Cải thiện độ ổn định, hiệu năng và sửa lỗi hệ thống.",
      publishedAt: data.published_at ? new Date(data.published_at).toLocaleDateString("vi-VN") : "",
      downloadUrl: setupDownloadUrl,
      portableUrl: portableDownloadUrl,
      htmlUrl: data.html_url || "https://github.com/BSilverB/adaptive-music/releases",
    };
  } catch (err) {
    console.error("[UpdateChecker] Lỗi kiểm tra phiên bản mới từ GitHub:", err);
    return null;
  }
}
