// Vercel serverless function entry point
// Imports the TanStack Start Node.js server build and adapts it for Vercel
import { createServer } from "node:http";

let handler;

async function getHandler() {
  if (!handler) {
    const server = await import("../dist/server/server.js");
    handler = server.default ?? server;
  }
  return handler;
}

export default async function (req, res) {
  const h = await getHandler();
  if (typeof h.fetch === "function") {
    // Fetch-based handler (Nitro/H3)
    const url = `https://${req.headers.host}${req.url}`;
    const headers = new Headers(req.headers);
    const method = req.method;

    let body = undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
      });
    }

    const request = new Request(url, { method, headers, body });
    const response = await h.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } else if (typeof h === "function") {
    h(req, res);
  } else {
    res.statusCode = 500;
    res.end("Server handler not found");
  }
}
