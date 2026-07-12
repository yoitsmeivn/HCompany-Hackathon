// Electron main process for the Kylian desktop app.
//
// This package lives in its own desktop-app/ folder with its own
// package.json/node_modules, separate from the web app in the parent
// directory. It boots the parent app's existing Express API server
// (server/index.ts, unmodified) as a child process, then opens a window on
// /setup — the same screen served by `npm run dev:web` at
// http://localhost:5173/setup.
//
// Dev mode: the parent app's source is read directly from ../ (server/,
// shared/). The window points at the Vite dev server (hot reload).
// Packaged mode: electron-builder copies dist/, server/, shared/ and
// node_modules from the parent into the packaged app's resources/ folder
// (see the "extraResources" section of package.json) — process.resourcesPath
// mirrors the parent app's layout, so the same relative paths resolve.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const isDev = !app.isPackaged;
const APP_ROOT = isDev ? path.join(__dirname, "..") : process.resourcesPath;
const API_PORT = process.env.KYLIAN_API_PORT || "8787";

let apiProcess = null;
let mainWindow = null;

function waitForHttp(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function startApiServer() {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    KYLIAN_API_PORT: API_PORT,
  };
  if (!isDev) {
    env.KYLIAN_STATIC_DIR = path.join(APP_ROOT, "dist");
  }
  apiProcess = spawn(
    process.execPath,
    ["--import", "tsx", path.join(APP_ROOT, "server", "index.ts")],
    { cwd: APP_ROOT, env, stdio: "inherit" },
  );
  apiProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`Kylian API server exited with code ${code}`);
  });
  return waitForHttp(`http://localhost:${API_PORT}/api/health`, 20_000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Kylian",
    backgroundColor: "#faf9f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? process.env.ELECTRON_START_URL || "http://localhost:5173/setup"
    : `http://localhost:${API_PORT}/setup`;

  mainWindow.loadURL(startUrl);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startApiServer();
  } catch (error) {
    console.error("Kylian API server failed to start:", error);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (apiProcess) apiProcess.kill();
});
