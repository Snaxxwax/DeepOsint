import express, { type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { ApiError, object, str, sha256, type Config } from "./core";
import { Store } from "./store";
import { ingest } from "./pipeline";
import { investigate } from "./search";
import { extract, semantic } from "./extract";
import { fileInput, preprocess, readExif } from "./media";
import {
  defaultSpec,
  validateResearch,
  runResearch,
  overrideResearch,
  testResearch,
  researchResult,
} from "./research";
import { csv, stix } from "./export";
import type {
  IngestedArtifact,
  ExtractedEntity,
  RelationalEdge,
} from "../src/types/osint";

export function createApp(config: Config, store = new Store(config.dataDir)) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  let active = 0;
  const wrap =
    (
      fn: (req: express.Request, res: express.Response) => Promise<any> | any,
    ): RequestHandler =>
    (req, res, next) => {
      Promise.resolve()
        .then(() => fn(req, res))
        .catch(next);
    };
  const expensive = (
    fn: (req: express.Request, res: express.Response) => Promise<any>,
  ): RequestHandler =>
    wrap(async (req, res) => {
      if (active >= config.maxConcurrent)
        throw new ApiError(429, "Backend is busy; retry shortly");
      active++;
      try {
        await fn(req, res);
      } finally {
        active--;
      }
    });
  const equal = (token: string) =>
    !!config.apiToken &&
    token.length < 1000 &&
    timingSafeEqual(
      Buffer.from(sha256(token)),
      Buffer.from(sha256(config.apiToken)),
    );
  const authorized = (req: express.Request) => {
    if (!config.apiToken) return true;
    const bearer = req.get("authorization")?.replace(/^Bearer /, "");
    const cookie = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("deeposint_session="))
      ?.slice("deeposint_session=".length);
    return !!((bearer && equal(bearer)) || (cookie && equal(cookie)));
  };
  const attempts = new Map<string, { count: number; reset: number }>();
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", authRequired: !!config.apiToken }),
  );
  app.post(
    "/api/session",
    express.json({ limit: "2kb" }),
    wrap((req, res) => {
      if (
        req.get("origin") &&
        new URL(req.get("origin")!).host !== req.get("host")
      )
        throw new ApiError(403, "Origin not allowed");
      const ip = req.ip || "unknown",
        t = Date.now();
      if (attempts.size > 1000)
        for (const [key, v] of attempts) if (v.reset < t) attempts.delete(key);
      const attempt = attempts.get(ip);
      const entry =
        attempt && attempt.reset > t ? attempt : { count: 0, reset: t + 60000 };
      if (++entry.count > 10)
        throw new ApiError(429, "Too many sign-in attempts");
      attempts.set(ip, entry);
      if (!config.apiToken) return res.json({ success: true });
      if (!equal(str(object(req.body).apiToken, "apiToken", 1000)))
        throw new ApiError(401, "Invalid API token");
      res.cookie("deeposint_session", config.apiToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: config.production,
        maxAge: 8 * 60 * 60 * 1000,
        path: "/api",
      });
      return res.json({ success: true });
    }),
  );
  app.use("/api", (req, res, next) => {
    if (!authorized(req))
      return res.status(401).json({ error: "Authentication required" });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin")) {
      try {
        if (new URL(req.get("origin")!).host !== req.get("host"))
          return res.status(403).json({ error: "Origin not allowed" });
      } catch {
        return res.status(403).json({ error: "Origin not allowed" });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", express.json({ limit: "16mb" }));
  app.delete("/api/session", (_req, res) => {
    res.clearCookie("deeposint_session", { path: "/api" });
    res.json({ success: true });
  });
  app.get("/api/state", (_req, res) => res.json(store.snapshot()));
  function page<T>(rows: T[], req: express.Request) {
    const offset = Number(req.query.offset || 0),
      limit = Number(req.query.limit || 50);
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    )
      throw new ApiError(400, "Invalid pagination");
    return {
      items: rows.slice(offset, offset + limit),
      total: rows.length,
      offset,
      limit,
    };
  }
  app.get(
    "/api/artifacts",
    wrap((req, res) => res.json(page(store.all("artifacts"), req))),
  );
  app.get(
    "/api/artifacts/:id",
    wrap((req, res) => {
      const artifact = store.get<IngestedArtifact>("artifacts", req.params.id);
      if (!artifact) throw new ApiError(404, "Artifact not found");
      const entities = store
        .all<ExtractedEntity>("entities")
        .filter((e) => e.artifactId === artifact.id);
      const ids = new Set(entities.map((e) => e.id));
      return res.json({
        artifact,
        entities,
        edges: store
          .all<RelationalEdge>("edges")
          .filter(
            (e) => ids.has(e.sourceEntityId) && ids.has(e.targetEntityId),
          ),
      });
    }),
  );
  app.get(
    "/api/artifacts/:id/original",
    wrap((req, res) => {
      const bytes = store.original(req.params.id);
      if (!bytes) throw new ApiError(404, "Original file not found");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="original.bin"',
      );
      res.type("application/octet-stream").send(bytes);
    }),
  );
  app.get(
    "/api/entities",
    wrap((req, res) => {
      const query = String(req.query.q || "").toLowerCase();
      const rows = store
        .all<ExtractedEntity>("entities")
        .filter(
          (e) =>
            (!req.query.artifactId || e.artifactId === req.query.artifactId) &&
            (!req.query.category || e.category === req.query.category) &&
            e.normalizedValue.includes(query),
        );
      return res.json(page(rows, req));
    }),
  );
  app.get("/api/graph", (_req, res) =>
    res.json({ entities: store.all("entities"), edges: store.all("edges") }),
  );
  app.get(
    "/api/jobs",
    wrap((req, res) => res.json(page(store.all("jobs"), req))),
  );
  app.get(
    "/api/jobs/:id",
    wrap((req, res) => {
      const j = store.get("jobs", req.params.id);
      if (!j) throw new ApiError(404, "Job not found");
      res.json(j);
    }),
  );
  app.get("/api/metrics", (_req, res) => {
    const arts = store.all<IngestedArtifact>("artifacts");
    const duration = arts.reduce((n, a) => n + a.processingTimeMs, 0);
    const bytes = arts.reduce((n, a) => n + a.contentByteLength, 0);
    res.json({
      metrics: {
        totalArtifactsIngested: arts.length,
        totalEntitiesExtracted: store.all("entities").length,
        totalRelationsMapped: store.all("edges").length,
        averageIngestionLatencyMs: arts.length
          ? Math.round(duration / arts.length)
          : 0,
        throughputKbPerSec: duration
          ? Math.round((((bytes / duration) * 1000) / 1024) * 10) / 10
          : 0,
        queueDepth: 0,
        activeWorkers: active ? 1 : 0,
        lastRunTimestamp: arts[0]?.ingestedAt || null,
      },
      workers: [
        {
          id: "backend",
          name: "Backend process",
          role: "Intake & Hash",
          status: active ? "busy" : "idle",
          tasksCompleted: arts.length,
          loadPercentage: Math.round((active / config.maxConcurrent) * 100),
          memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      ],
    });
  });
  app.post(
    "/api/ingest",
    expensive(async (req, res) =>
      res.status(201).json(await ingest(req.body, store, config)),
    ),
  );
  app.post(
    "/api/gemini/extract-entities",
    expensive(async (req, res) => {
      const id = str(object(req.body).artifactId, "artifactId");
      const artifact = store.get<IngestedArtifact>("artifacts", id);
      if (!artifact) throw new ApiError(404, "Artifact not found");
      res.json({
        success: true,
        ...(await semantic(
          artifact.rawContent,
          id,
          artifact.sha256Hash,
          config,
          extract(artifact.rawContent, id, artifact.sha256Hash),
        )),
      });
    }),
  );
  app.post(
    "/api/search/investigate",
    expensive(async (req, res) =>
      res.status(201).json(await investigate(req.body, store, config)),
    ),
  );
  app.get(
    "/api/investigations",
    wrap((req, res) => res.json(page(store.all("investigations"), req))),
  );
  app.get(
    "/api/investigations/:id",
    wrap((req, res) => {
      const d = store.get("investigations", req.params.id);
      if (!d) throw new ApiError(404, "Investigation not found");
      res.json({ dossier: d });
    }),
  );
  app.get("/api/capabilities", (_req, res) =>
    res.json({
      searchProvider: config.searchProvider,
      semanticConfigured: !!config.geminiKey,
      semanticModel: config.geminiModel,
      fileTypes: ["text", "pdf", "jpeg", "png"],
      tor: false,
      breachDatabase: false,
      alprDatabase: false,
    }),
  );
  app.post(
    "/api/ocr/parse",
    expensive(async (req, res) => {
      const b = object(req.body);
      const result =
        b.textContent !== undefined
          ? { text: str(b.textContent, "textContent", 2_000_000), warnings: [] }
          : await preprocess(fileInput(b));
      const detectedPlates = extract(result.text, "ocr", "")
        .entities.filter((e) => e.subType === "license_plate")
        .map((e) => e.value);
      res.json({
        success: true,
        extractedText: result.text,
        detectedPlates,
        warnings: result.warnings,
        timestamp: new Date().toISOString(),
      });
    }),
  );
  app.post(
    "/api/exif/extract",
    expensive(async (req, res) =>
      res.json({ success: true, exif: await readExif(fileInput(req.body)) }),
    ),
  );
  app.post(
    "/api/provenance/verify",
    wrap((req, res) => {
      const b = object(req.body);
      let content: string | Buffer, expected: string;
      if (b.artifactId !== undefined) {
        const artifact = store.get<IngestedArtifact>(
          "artifacts",
          str(b.artifactId, "artifactId"),
        );
        if (!artifact) throw new ApiError(404, "Artifact not found");
        if (b.original === true) {
          const bytes = store.original(artifact.id);
          if (!bytes) throw new ApiError(404, "Original file not found");
          content = bytes;
          expected = artifact.originalSha256Hash!;
        } else {
          content =
            b.rawContent === undefined
              ? artifact.rawContent
              : typeof b.rawContent === "string"
                ? b.rawContent
                : str(b.rawContent, "rawContent");
          expected = artifact.sha256Hash;
        }
      } else {
        content =
          typeof b.rawContent === "string"
            ? b.rawContent
            : str(b.rawContent, "rawContent");
        expected = str(b.expectedSha256, "expectedSha256", 64);
      }
      if (!/^[a-f0-9]{64}$/i.test(expected))
        throw new ApiError(400, "Expected SHA-256 must be 64 hex characters");
      const computedHash = sha256(content);
      res.json({
        success: true,
        isValid: computedHash === expected.toLowerCase(),
        computedHash,
        expectedSha256: expected,
      });
    }),
  );
  for (const format of ["stix", "csv"] as const)
    app.post(
      `/api/export/${format}`,
      wrap((req, res) => {
        const b = object(req.body);
        const artifactId =
          b.artifactId === undefined
            ? undefined
            : str(b.artifactId, "artifactId");
        const artifact = artifactId
          ? store.get<IngestedArtifact>("artifacts", artifactId)
          : undefined;
        if (artifactId && !artifact)
          throw new ApiError(404, "Artifact not found");
        const entities = store
          .all<ExtractedEntity>("entities")
          .filter((e) => !artifactId || e.artifactId === artifactId);
        const ids = new Set(entities.map((e) => e.id));
        const edges = store
          .all<RelationalEdge>("edges")
          .filter(
            (e) => ids.has(e.sourceEntityId) && ids.has(e.targetEntityId),
          );
        return format === "stix"
          ? res.json(stix(entities, edges, artifact))
          : res.type("text/csv").send(csv(entities));
      }),
    );
  app.get(
    "/api/rloop/specs",
    wrap(async (_req, res) =>
      res.json({
        specs: [
          {
            id: "fed_chair",
            title: "Federal Reserve reference fixture",
            spec: await defaultSpec(),
          },
        ],
      }),
    ),
  );
  app.post(
    "/api/rloop/validate",
    expensive(async (req, res) => {
      await validateResearch(object(req.body).spec, config);
      res.json({ valid: true });
    }),
  );
  app.post(
    "/api/rloop/run",
    expensive(async (req, res) =>
      res.json(await runResearch(req.body, store, config)),
    ),
  );
  app.get("/api/rloop/runs", (_req, res) =>
    res.json({
      runs: store.all<any>("jobs").filter((j) => j.kind === "research"),
    }),
  );
  app.get(
    "/api/rloop/runs/:id",
    wrap(async (req, res) =>
      res.json(await researchResult(req.params.id, store, config)),
    ),
  );
  app.post(
    "/api/rloop/override",
    expensive(async (req, res) =>
      res.json(await overrideResearch(req.body, store, config)),
    ),
  );
  if (!config.production)
    app.get(
      "/api/rloop/tests",
      expensive(async (_req, res) => res.json(await testResearch(config))),
    );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        err instanceof ApiError
          ? err.status
          : err.type === "entity.too.large"
            ? 413
            : err instanceof SyntaxError
              ? 400
              : 500;
      if (status === 500) console.error("Backend error:", err.name);
      res
        .status(status)
        .json({
          error:
            status === 500
              ? "Internal server error"
              : status === 413
                ? "Request body too large"
                : err instanceof ApiError
                  ? err.message
                  : "Invalid JSON request",
        });
    },
  );
  return { app, store };
}
