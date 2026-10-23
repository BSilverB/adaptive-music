const net = require("net");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn, execSync } = require("child_process");

let mainWindow = null;
let pythonProcess = null;
let currentPort = null;
let isQuitting = false;
let backendOutputLogs = [];

// Đường dẫn file nhật ký khởi động để chẩn đoán lỗi
const logDir = path.join(app.getPath("userData") || app.getPath("temp"), "AdaptiveFlowLogs");
try {
  fs.mkdirSync(logDir, { recursive: true });
} catch (e) {}
const logFilePath = path.join(logDir, "startup_debug.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFilePath, line, "utf8");
  } catch (e) {}
  console.log(msg);
}

// 1. Quét tìm Port còn trống (Dynamic Port Finder từ 8000 đến 8050)
function getFreePort(startPort = 8000, maxAttempts = 50) {
  return new Promise((resolve) => {
    function tryPort(p) {
      if (p >= startPort + maxAttempts) {
        resolve(startPort);
        return;
      }
      const server = net.createServer();
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
    log(`[Electron] Đang tắt tiến trình Python Backend (PID: ${pid})...`);

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
      } catch (e) {}
    }

    setTimeout(() => {
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
        } else {
          pythonProcess.kill("SIGKILL");
        }
      } catch (e) {}
      pythonProcess = null;
      log(`[Electron] Python backend đã tắt hoàn toàn.`);
    }, 400);
  }
}

// 3. Healthcheck chờ backend sẵn sàng
function waitForBackend(port, timeoutMs = 25000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    let checkInterval = null;

    const cleanup = () => {
      if (checkInterval) clearInterval(checkInterval);
    };

    checkInterval = setInterval(() => {
      if (!pythonProcess) {
        cleanup();
        return reject(new Error("Tiến trình Backend đã bị hủy trước khi hoàn tất khởi động."));
      }

      const req = http.get(`http://127.0.0.1:${port}/api/system-profile`, (res) => {
        if (res.statusCode === 200) {
          cleanup();
          resolve(true);
        }
      });

      req.on("error", () => {
        if (Date.now() - startTime > timeoutMs) {
          cleanup();
          const recentLogs = backendOutputLogs.slice(-15).join("\n");
          reject(new Error(`Backend healthcheck timeout sau ${timeoutMs / 1000}s tại port ${port}.\n\nChi tiết log:\n${recentLogs}`));
        }
      });
      req.end();
    }, 400);
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
      webSecurity: false,
    },
  });

  const distIndex = path.join(__dirname, "..", "frontend", "dist", "index.html");

  if (process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?port=${port}`);
  } else {
    await mainWindow.loadFile(distIndex, { query: { port: String(port) } });
  }

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
  log(`=== KHỞI ĐỘNG ỨNG DỤNG (isPackaged: ${app.isPackaged}) ===`);
  try {
    currentPort = await getFreePort(8000);
    process.env.BACKEND_PORT = String(currentPort);
    log(`[Electron] Đã chọn Port: ${currentPort}`);

    const backendDir = app.isPackaged
      ? path.join(process.resourcesPath, "backend")
      : path.join(__dirname, "..", "backend");

    const standaloneExe = path.join(backendDir, "backend_engine.exe");
    const backendScript = path.join(backendDir, "main.py");

    let spawnCmd, spawnArgs;
    if (fs.existsSync(standaloneExe)) {
      log(`[Electron] Phát hiện Backend Engine độc lập: ${standaloneExe}`);
      spawnCmd = standaloneExe;
      spawnArgs = ["--port", String(currentPort), "--watchdog"];
    } else {
      log(`[Electron] Sử dụng Python hệ thống: python ${backendScript}`);
      spawnCmd = "python";
      spawnArgs = ["-u", backendScript, "--port", String(currentPort), "--watchdog"];
    }

    log(`[Electron] Chuẩn bị spawn: "${spawnCmd}"`);
    pythonProcess = spawn(spawnCmd, spawnArgs, {
      cwd: backendDir,
      stdio: "pipe",
      env: {
        ...process.env,
        BACKEND_PORT: String(currentPort),
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
    });

    pythonProcess.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      backendOutputLogs.push(`[STDOUT] ${msg}`);
      log(`[Backend] ${msg}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      backendOutputLogs.push(`[STDERR] ${msg}`);
      log(`[Backend ERR] ${msg}`);
    });

    pythonProcess.on("error", (err) => {
      log(`[Backend Process Error] Không thể khởi chạy process: ${err.message}`);
      dialog.showErrorBox(
        "Lỗi Khởi Chạy Bộ Não Backend",
        `Không thể thực thi tiến trình Backend (${spawnCmd}):\n\n${err.message}\n\nNguyên nhân có thể do Windows Defender hoặc Antivirus đã chặn file này.\nXem chi tiết tại:\n${logFilePath}`
      );
    });

    pythonProcess.on("exit", (code, signal) => {
      log(`[Backend Exit] Thoát với mã: ${code}, signal: ${signal}`);
      if (code !== 0 && code !== null && !isQuitting) {
        const errorSummary = backendOutputLogs.slice(-10).join("\n") || "Không có thông tin lỗi chi tiết.";
        dialog.showErrorBox(
          "Lỗi Tiến Trình Backend",
          `Bộ não backend đã dừng đột ngột (Mã lỗi: ${code}).\n\nChi tiết log gần nhất:\n${errorSummary}\n\nVui lòng kiểm tra file nhật ký tại:\n${logFilePath}`
        );
      }
      if (mainWindow && !mainWindow.isDestroyed() && !isQuitting) {
        mainWindow.close();
      }
    });

    log(`[Electron] Đang chờ Backend phản hồi tại http://127.0.0.1:${currentPort}...`);
    await waitForBackend(currentPort);
    log(`[Electron] Backend sẵn sàng! Đang mở cửa sổ chính...`);

    await createWindow(currentPort);
  } catch (err) {
    log(`[Electron Startup Catch] ${err.stack || err.message}`);
    dialog.showErrorBox(
      "Không Thể Mở Ứng Dụng",
      `Ứng dụng không thể kết nối tới Backend sau 25 giây:\n\n${err.message}\n\nXem file log chẩn đoán tại:\n${logFilePath}`
    );
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
