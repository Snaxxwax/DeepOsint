import "dotenv/config";
import path from "node:path";
import express from "express";
import { createApp } from "./backend/app";
import { configFromEnv } from "./backend/core";

const config = configFromEnv();
const { app, store } = createApp(config);
if (!config.production) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve("dist")));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
}
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (config.production ? "0.0.0.0" : "127.0.0.1");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT");
const server = app.listen(port, host, () =>
  console.log(`DeepOsint listening on http://${host}:${port}`),
);
server.requestTimeout = 180000;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
