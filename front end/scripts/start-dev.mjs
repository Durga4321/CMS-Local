import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 3000);
const landingPath = process.env.LANDING_PATH || "/";
const landingUrl = `http://localhost:${port}${landingPath}`;
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

if (!existsSync(viteCli)) {
  console.error("Vite is not installed. Run npm install, then try npm start again.");
  process.exit(1);
}

let chromeOpened = false;

const vite = spawn(process.execPath, [viteCli, "--host", "0.0.0.0"], {
  cwd: rootDir,
  env: {
    ...process.env,
    BROWSER: "none",
  },
  stdio: "inherit",
});

vite.once("error", (error) => {
  console.error("Failed to start Vite:", error.message);
  process.exitCode = 1;
});

const spawnDetached = (command, args, options = {}) => {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    ...options,
  });

  child.unref();
  return child;
};

const openChrome = () => {
  if (chromeOpened) return;
  chromeOpened = true;

  if (process.platform === "win32") {
    const chromePaths = [
      process.env.PROGRAMFILES
        ? path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
        : "",
      process.env["PROGRAMFILES(X86)"]
        ? path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe")
        : "",
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
        : "",
    ].filter(Boolean);

    const installedChrome = chromePaths.find((chromePath) => existsSync(chromePath));
    if (installedChrome) {
      spawnDetached(installedChrome, [landingUrl]);
      return;
    }

    spawnDetached("cmd.exe", ["/d", "/s", "/c", "start", "", "chrome", landingUrl]);
    return;
  }

  if (process.platform === "darwin") {
    spawnDetached("open", ["-a", "Google Chrome", landingUrl]);
    return;
  }

  const child = spawnDetached("google-chrome", [landingUrl]);
  child.once("error", () => spawnDetached("chromium-browser", [landingUrl]));
};

const waitForServer = () => {
  const request = http.get(landingUrl, (response) => {
    response.resume();
    openChrome();
  });

  request.on("error", () => {
    if (!vite.killed) setTimeout(waitForServer, 500);
  });

  request.setTimeout(1000, () => {
    request.destroy();
  });
};

vite.once("spawn", waitForServer);
vite.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

const stop = () => {
  if (!vite.killed) vite.kill("SIGTERM");
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
