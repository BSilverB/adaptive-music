/**
 * Cấu hình kết nối API & WebSocket động (Dynamic Port Resolution)
 * Hỗ trợ tự động kết nối qua Electron Preload, URL Query Params hoặc mặc định 8000.
 */

export function getBackendPort(): number {
  if (typeof window !== "undefined") {
    // 1. Kiểm tra biến môi trường Electron inject qua Preload script
    if ((window as any).__BACKEND_PORT__) {
      return Number((window as any).__BACKEND_PORT__);
    }

    // 2. Kiểm tra tham số URL (?port=xxxx)
    if (window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const p = params.get("port");
      if (p && !isNaN(Number(p))) {
        return Number(p);
      }
    }
  }

  // 3. Fallback mặc định 8000
  return 8000;
}

export function getApiBaseUrl(): string {
  return `http://127.0.0.1:${getBackendPort()}`;
}

export function getWsBaseUrl(): string {
  return `ws://127.0.0.1:${getBackendPort()}`;
}
