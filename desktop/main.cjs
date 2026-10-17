const { app, BrowserWindow, shell } = require("electron");
const { appUrl } = require("./config.json");

const trustedOrigin = new URL(appUrl).origin;

function isTrusted(url) {
  try {
    return new URL(url).origin === trustedOrigin;
  } catch {
    return false;
  }
}

function openExternal(url) {
  try {
    if (new URL(url).protocol === "https:") void shell.openExternal(url);
  } catch {
    // Ignore malformed links from untrusted page content.
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    title: "Fieldnotes Workspace",
    backgroundColor: "#f8faf6",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrusted(url)) return { action: "allow" };
    openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isTrusted(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  void window.loadURL(appUrl);
}

app.whenReady().then(() => {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
