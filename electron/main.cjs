const net = require("net");
const path = require("path");
const http = require("http");
const { app, BrowserWindow, shell } = require("electron");
const { spawn, execSync } = require("child_process");

let mainWindow = null;
let pythonProcess = null;
let currentPort = null;
let isQuitting = false;

// 1. Quét tìm Port còn trống (Dynamic Port Finder từ 8000 đến 8050)
function getFreePort(startPort = 8000, maxAttempts = 50) {
  return new Promise((resolve) => {
    function tryPort(p) {
      if (p >= startPort + maxAttempts) {
        resolve(startPort);
        return;
      }
      const server = net.createServer();
      server.unref();
      server.on("error", () => {
        tryPort(p + 1);
      });
      server.listen(p, "127.0.0.1", () => {
        server.close(() => {
          resolve(p);
        });
      });
    }
    tryPort(startPort);
  });
}

// 2. Diệt sạch tiến trình Python triệt để (Không để lại tiến trình ma)
function killPythonProcess() {
  if (isQuitting) return;
  isQuitting = true;

  if (pythonProcess && pythonProcess.pid) {
    const pid = pythonProcess.pid;
    console.log(`[Electron] Đang tắt tiến trình Python Backend (PID: ${pid})...`);

    // Gửi tín hiệu shutdown HTTP endpoint trước
    if (currentPort) {
      try {
        const req = http.request({
          hostname: "127.0.0.1",
          port: currentPort,
          path: "/api/system/shutdown",
          method: "POST",
          timeout: 1000,
        });
        req.on("error", () => {});
        req.end();
      } catch (e) {
        // bỏ qua
      }
    }

    // Windows Taskkill tree-kill để đảm bảo tất cả process con bị hạ gục
    setTimeout(() => {
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
        } else {
          pythonProcess.kill("SIGKILL");
        }
      } catch (e) {
        // Tiến trình đã thoát
      }
      pythonProcess = null;
      console.log(`[Electron] Python backend đã tắt hoàn toàn.`);
    }, 400);
  }
}

// 3. Healthcheck chờ backend sẵn sàng trước khi nạp giao diện
function waitForBackend(port, timeoutMs = 20000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const req = http.get(`http://127.0.0.1:${port}/api/system-profile`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      });
      req.on("error", () => {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Backend healthcheck timeout sau ${timeoutMs}ms`));
        }
      });
      req.end();
    }, 350);
  });
}

// 4. Tạo cửa sổ chính
async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#07090e",
    autoHideMenuBar: true,
    title: "Adaptive Flow & Beat Engine",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Cho phép fetch local audio/blob từ backend
    },
  });

  const distIndex = path.join(__dirname, "..", "frontend", "dist", "index.html");

  if (process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?port=${port}`);
  } else {
    await mainWindow.loadFile(distIndex, { query: { port: String(port) } });
  }

  // Mở link ngoài bằng trình duyệt mặc định
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    killPythonProcess();
  });
}

// 5. Khởi động ứng dụng Electron
app.whenReady().then(async () => {
  try {
    currentPort = await getFreePort(8000);
    process.env.BACKEND_PORT = String(currentPort);
    console.log(`[Electron] Tìm thấy Port khả dụng: ${currentPort}`);

    // Hỗ trợ cả môi trường dev và packaged (.exe)
    const backendDir = app.isPackaged
      ? path.join(process.resourcesPath, "backend")
      : path.join(__dirname, "..", "backend");

    const standaloneExe = path.join(backendDir, "backend_engine.exe");
    const backendScript = path.join(backendDir, "main.py");
    const fs = require("fs");

    let spawnCmd, spawnArgs;
    if (fs.existsSync(standaloneExe)) {
      console.log(`[Electron] Khởi chạy Backend Engine độc lập: ${standaloneExe}`);
      spawnCmd = standaloneExe;
      spawnArgs = ["--port", String(currentPort), "--watchdog"];
    } else {
      console.log(`[Electron] Khởi chạy Python hệ thống: python ${backendScript}`);
      spawnCmd = "python";
      spawnArgs = ["-u", backendScript, "--port", String(currentPort), "--watchdog"];
    }

    pythonProcess = spawn(spawnCmd, spawnArgs, {
      cwd: backendDir,
      stdio: "pipe",
      env: { ...process.env, BACKEND_PORT: String(currentPort) },
    });

    pythonProcess.stdout.on("data", (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`[Backend ERR] ${data.toString().trim()}`);
    });

    pythonProcess.on("exit", (code) => {
      console.log(`[Electron] Tiến trình Python thoát với mã: ${code}`);
      if (mainWindow && !mainWindow.isDestroyed() && !isQuitting) {
        mainWindow.close();
      }
    });

    console.log(`[Electron] Đang chờ Backend khởi tạo tại http://127.0.0.1:${currentPort}...`);
    await waitForBackend(currentPort);
    console.log(`[Electron] Backend sẵn sàng! Đang mở cửa sổ ứng dụng...`);

    await createWindow(currentPort);
  } catch (err) {
    console.error("[Electron] Lỗi khởi động:", err);
    killPythonProcess();
    app.quit();
  }
});

// Xử lý các sự kiện đóng ứng dụng
app.on("before-quit", () => {
  killPythonProcess();
});

app.on("window-all-closed", () => {
  killPythonProcess();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("SIGINT", () => {
  killPythonProcess();
  process.exit(0);
});

process.on("SIGTERM", () => {
  killPythonProcess();
  process.exit(0);
});
