const {
  app,
  BrowserWindow,
  dialog,
  shell,
} = require("electron");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { extname, join, resolve, sep } = require("node:path");

const API_BASE_URL = "https://calculatrice-production.up.railway.app";
const PUBLIC_SITE_URL = "https://calculatrice-sondage.vercel.app/";
const ADMIN_DIRECTORY = resolve(__dirname, "..", "admin-dist");
const LOCAL_HOST = "127.0.0.1";
const MAX_API_BODY_SIZE = 64 * 1024;
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

let adminServer;
let adminOrigin;

async function readRequestBody(request) {
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > MAX_API_BODY_SIZE) {
      const error = new Error("La requête est trop volumineuse.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyApiRequest(request, response, requestUrl) {
  if (!["GET", "POST", "PATCH"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, POST, PATCH" });
    response.end();
    return;
  }

  const headers = {};
  for (const name of ["accept", "content-type"]) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }

  let body;
  if (request.method !== "GET") {
    body = await readRequestBody(request);
  }

  let upstream;
  try {
    upstream = await fetch(
      new URL(`${requestUrl.pathname}${requestUrl.search}`, API_BASE_URL),
      { method: request.method, headers, body },
    );
  } catch (error) {
    console.error("Railway API request failed.", error);
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: "L’API Railway est injoignable." }));
    return;
  }

  const responseHeaders = {};
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders[name] = value;
  }
  response.writeHead(upstream.status, responseHeaders);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function handleLocalRequest(request, response) {
  const address = adminServer.address();
  const requestUrl = new URL(request.url, `http://${LOCAL_HOST}:${address.port}`);
  const localHost = `${LOCAL_HOST}:${address.port}`;

  if (request.headers.host !== localHost) {
    response.writeHead(403);
    response.end();
    return;
  }
  if (request.headers.origin && request.headers.origin !== adminOrigin) {
    response.writeHead(403);
    response.end();
    return;
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    await proxyApiRequest(request, response, requestUrl);
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" });
    response.end();
    return;
  }

  const requestedPath = decodeURIComponent(requestUrl.pathname);
  const filePath = resolve(
    ADMIN_DIRECTORY,
    requestedPath === "/" ? "admin.html" : `.${requestedPath}`,
  );
  if (!filePath.startsWith(`${ADMIN_DIRECTORY}${sep}`)) {
    response.writeHead(404);
    response.end();
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end();
      return;
    }
    throw error;
  }
}

function startAdminServer() {
  if (adminServer) return Promise.resolve(adminOrigin);
  return new Promise((resolveServer, rejectServer) => {
    adminServer = createServer((request, response) => {
      handleLocalRequest(request, response).catch((error) => {
        console.error("Local administration server request failed.", error);
        if (!response.headersSent) {
          response.writeHead(error.statusCode || 500, {
            "Content-Type": "application/json",
          });
        }
        response.end(JSON.stringify({ detail: "Erreur du serveur local." }));
      });
    });
    adminServer.once("error", rejectServer);
    adminServer.listen(0, LOCAL_HOST, () => {
      const { port } = adminServer.address();
      adminOrigin = `http://${LOCAL_HOST}:${port}`;
      resolveServer(adminOrigin);
    });
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#070b12",
    title: "Sondage Admin",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === PUBLIC_SITE_URL) {
      shell.openExternal(url).catch((error) => {
        console.error("Could not open the public survey website.", error);
      });
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== adminOrigin) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, target) => {
    if (new URL(target).origin !== adminOrigin) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());

  try {
    const localOrigin = await startAdminServer();
    await window.loadURL(`${localOrigin}/admin.html`);
  } catch (error) {
    dialog.showErrorBox(
      "Démarrage de l’atelier impossible",
      `Relancez Sondage Admin ou réinstallez l’application.\n\n${error.message}`,
    );
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on("before-quit", () => {
  if (adminServer) adminServer.close();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
