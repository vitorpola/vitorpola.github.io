#!/usr/bin/env node
/**
 * Servidor local para testar o site do Carnaval em ambiente próximo ao GitHub Pages.
 * Simula a estrutura: https://vitorpola.github.io/carnaval/
 *
 * Uso: node server.js [porta]
 * Exemplo: node server.js 3000
 * Acesse: http://localhost:3000/carnaval/
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.argv[2] || "3000", 10);

// Diretório onde está o server.js (carnaval/)
const DIR_CARNAVAL = __dirname;
// No GitHub Pages, o site está em /carnaval/
const BASE_PATH = "/carnaval";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getMimeType(ext) {
  return MIME_TYPES[ext] || "application/octet-stream";
}

function resolvePath(urlPath) {
  if (urlPath === BASE_PATH || urlPath === BASE_PATH + "/") {
    return path.join(DIR_CARNAVAL, "index.html");
  }
  if (urlPath.startsWith(BASE_PATH + "/")) {
    const rel = urlPath.slice(BASE_PATH.length);
    return path.join(DIR_CARNAVAL, path.normalize(rel));
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let urlPath = url.pathname;

  // Redireciona / para /carnaval/
  if (urlPath === "/") {
    res.writeHead(302, { Location: BASE_PATH + "/" });
    res.end();
    return;
  }

  const filePath = resolvePath(urlPath);

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
    return;
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(DIR_CARNAVAL)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("500 Internal Server Error");
      }
      return;
    }

    const ext = path.extname(resolved);
    res.writeHead(200, {
      "Content-Type": getMimeType(ext),
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Carnaval 2026 — servidor local\n`);
  console.log(`  Simula: https://vitorpola.github.io/carnaval/`);
  console.log(`  Acesse: http://localhost:${PORT}/carnaval/\n`);
});
