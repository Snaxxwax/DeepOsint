import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../backend/app";
import { Store } from "../backend/store";
import { sha256, configFromEnv, type Config } from "../backend/core";
import { investigate } from "../backend/search";
import { extract } from "../backend/extract";
import { fileKind, readExif, decodeBase64 } from "../backend/media";

async function setup(extra: Partial<Config> = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "deeposint-test-"));
  const config: Config = {
    dataDir,
    production: false,
    geminiModel: "test-model",
    searchProvider: "none",
    python: "python3",
    maxConcurrent: 2,
    ...extra,
  };
  const { app, store } = createApp(config);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (
    url: string,
    body?: object,
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(base + url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  };
  return {
    config,
    store,
    base,
    request,
    cleanup: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      store.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}
const text =
  "NAME: Alice Example\nEMAIL: alice@example.org\nPHONE: +1 (202) 555-0123\n\nNAME: Bob Example\nEMAIL: bob@example.org\nGPS: 30.2672 N, 97.7431 W";

test("ingestion hashes exact UTF-8 bytes, persists graph references and survives reopening", async () => {
  const s = await setup();
  try {
    const result = await s.request("/api/ingest", {
      rawContent: text,
      title: "Evidence",
      sourceType: "public_profile",
      useGeminiNlp: true,
    });
    assert.equal(result.status, 201);
    const { artifact, entities, edges, warnings } = result.data;
    assert.equal(artifact.sha256Hash, sha256(text));
    assert.equal(artifact.contentByteLength, Buffer.byteLength(text));
    assert.ok(warnings[0].includes("GEMINI"));
    assert.ok(entities.some((e: any) => e.value === "alice@example.org"));
    const geo = entities.find((e: any) => e.subType === "exif_coordinates");
    assert.equal(geo.metadata.longitude, -97.7431);
    for (const e of entities) {
      assert.equal(e.artifactId, artifact.id);
      assert.equal(e.provenance.sourceHash, artifact.sha256Hash);
      assert.equal(
        text.slice(
          e.provenance.sourceOffset,
          e.provenance.sourceOffset + e.value.length,
        ),
        e.value,
      );
    }
    const ids = new Set(entities.map((e: any) => e.id));
    for (const e of edges) {
      assert.ok(ids.has(e.sourceEntityId));
      assert.ok(ids.has(e.targetEntityId));
      assert.equal(e.relationship, "CO_OCCURS_WITH");
    }
    const detail = await s.request(`/api/artifacts/${artifact.id}`);
    assert.deepEqual(detail.data.artifact, artifact);
    const reopened = new Store(s.config.dataDir);
    assert.equal(reopened.snapshot().artifacts.length, 1);
    reopened.close();
  } finally {
    await s.cleanup();
  }
});
test("tampering fails verification; empty text hash verification is valid", async () => {
  const s = await setup();
  try {
    const saved = (await s.request("/api/ingest", { rawContent: "snowman ☃" }))
      .data;
    assert.equal(
      (
        await s.request("/api/provenance/verify", {
          artifactId: saved.artifact.id,
        })
      ).data.isValid,
      true,
    );
    assert.equal(
      (
        await s.request("/api/provenance/verify", {
          artifactId: saved.artifact.id,
          rawContent: "tampered",
        })
      ).data.isValid,
      false,
    );
    assert.equal(
      (
        await s.request("/api/provenance/verify", {
          rawContent: "",
          expectedSha256: sha256(""),
        })
      ).data.isValid,
      true,
    );
  } finally {
    await s.cleanup();
  }
});
test("malformed ingestion is rejected before persistence", async () => {
  const s = await setup();
  try {
    for (const body of [
      { rawContent: 5 },
      { rawContent: "" },
      { rawContent: "a", sourceType: "unknown" },
      { rawContent: "a", useGeminiNlp: "true" },
      { fileBase64: "not-base64" },
    ])
      assert.equal((await s.request("/api/ingest", body)).status, 400);
    assert.equal((await s.request("/api/state")).data.artifacts.length, 0);
    const bad = await fetch(s.base + "/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(bad.status, 400);
    assert.equal((await s.request("/api/unknown")).status, 404);
  } finally {
    await s.cleanup();
  }
});
test("API authentication covers data, exports and research; cookie login and origin checks", async () => {
  const s = await setup({
    apiToken: "this-is-a-long-operator-token-for-tests",
  });
  try {
    for (const url of ["/api/state", "/api/jobs", "/api/rloop/runs"])
      assert.equal((await s.request(url)).status, 401);
    assert.equal((await s.request("/api/export/stix", {})).status, 401);
    assert.equal(
      (
        await s.request("/api/state", undefined, {
          Authorization: `Bearer ${s.config.apiToken}`,
        })
      ).status,
      200,
    );
    assert.equal(
      (await s.request("/api/session", { apiToken: "wrong" })).status,
      401,
    );
    const login = await s.request("/api/session", {
      apiToken: s.config.apiToken,
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!;
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("SameSite=Strict"));
    assert.equal(
      (
        await s.request("/api/state", undefined, {
          Cookie: cookie.split(";")[0],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await s.request(
          "/api/ingest",
          { rawContent: "test" },
          { Cookie: cookie.split(";")[0], Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
  } finally {
    await s.cleanup();
  }
});
test("file evidence preserves original bytes and source hash independently", async () => {
  const s = await setup();
  try {
    const bytes = Buffer.from("EMAIL: file@example.org\r\n");
    const result = await s.request("/api/ingest", {
      title: "file.txt",
      fileBase64: bytes.toString("base64"),
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.artifact.originalSha256Hash, sha256(bytes));
    const file = await fetch(
      s.base + `/api/artifacts/${result.data.artifact.id}/original`,
    );
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    assert.equal(
      (
        await s.request("/api/provenance/verify", {
          artifactId: result.data.artifact.id,
          original: true,
        })
      ).data.isValid,
      true,
    );
  } finally {
    await s.cleanup();
  }
});
test("search without configuration is explicit; uploaded evidence produces grounded dossier", async () => {
  const s = await setup();
  try {
    assert.equal(
      (
        await s.request("/api/search/investigate", {
          identifiers: ["alice@example.org"],
        })
      ).status,
      503,
    );
    const result = await s.request("/api/search/investigate", {
      identifiers: [{ value: "alice@example.org", type: "email" }],
      companionFiles: [
        { name: "notes.txt", content: "EMAIL: alice@example.org" },
      ],
    });
    assert.equal(result.status, 201);
    const d = result.data.dossier;
    assert.equal(d.hits.length, 1);
    assert.equal(d.hits[0].evidenceScope, "uploaded_file");
    assert.equal(d.hits[0].threatLevel, "UNKNOWN");
    assert.equal(d.extractedEntities[0].artifactId, d.hits[0].artifactId);
    assert.ok(d.reasoningSummary.includes("No Tor"));
    assert.equal(
      (await s.request(`/api/investigations/${d.id}`)).data.dossier.auditHash,
      d.auditHash,
    );
  } finally {
    await s.cleanup();
  }
});
test("provider adapter results are deduplicated by URL and saved as snippets", async () => {
  const s = await setup();
  try {
    const d = (
      await investigate(
        { identifiers: ["alice@example.org"], searchDepth: "comprehensive" },
        s.store,
        { ...s.config, searchProvider: "brave" },
        async () => [
          {
            url: "https://example.org/profile",
            title: "Profile",
            snippet: "EMAIL: alice@example.org",
          },
        ],
      )
    ).dossier;
    assert.equal(d.totalHits, 1);
    assert.equal(d.hits[0].evidenceScope, "search_snippet");
    assert.equal(d.queriesFormulated.length, 3);
    assert.equal(s.store.snapshot().artifacts.length, 1);
  } finally {
    await s.cleanup();
  }
});
test("STIX export uses UUIDs, includes relationship refs, and CSV escapes formulas", async () => {
  const s = await setup();
  try {
    await s.request("/api/ingest", {
      rawContent: 'NAME: =HYPERLINK("evil")\nEMAIL: alice@example.org',
    });
    const bundle = (await s.request("/api/export/stix", {})).data;
    for (const o of bundle.objects)
      assert.match(o.id, /^[a-z0-9-]+--[a-f0-9-]{36}$/);
    const ids = new Set(bundle.objects.map((o: any) => o.id));
    for (const rel of bundle.objects.filter(
      (o: any) => o.type === "relationship",
    )) {
      assert.ok(ids.has(rel.source_ref));
      assert.ok(ids.has(rel.target_ref));
    }
    const result = await s.request("/api/export/csv", {});
    assert.ok(result.data.includes("'=HYPERLINK"));
  } finally {
    await s.cleanup();
  }
});
test("media never invents metadata and validates encodings", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7y0AAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(fileKind(png), "image");
  assert.deepEqual(await readExif(png), { hasExif: false });
  assert.throws(() => decodeBase64("@@@"));
  assert.throws(() => fileKind(Buffer.from([0, 1, 2, 3])));
});
test("research runs are isolated, resume works, override treats shell syntax as literal", async () => {
  const s = await setup();
  try {
    const runs = await Promise.all([
      s.request("/api/rloop/run", { provider: "fixture" }),
      s.request("/api/rloop/run", { provider: "fixture" }),
    ]);
    for (const r of runs) {
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.ok(r.data.reportMd.includes("Research Brief"));
      assert.ok(r.data.dbState.runs.length);
    }
    assert.notEqual(runs[0].data.runId, runs[1].data.runId);
    const runId = runs[0].data.runId;
    const result = await s.request("/api/rloop/run", { resume: true, runId });
    assert.equal(result.status, 200);
    assert.equal(result.data.runId, runId);
    const marker = path.join(s.config.dataDir, "injected");
    const reason = `Literal "quote"; $(touch ${marker}) \n retained`;
    const overridden = await s.request("/api/rloop/override", {
      runId,
      slotId: "chair",
      grade: "B",
      reason,
    });
    assert.equal(overridden.status, 200, JSON.stringify(overridden.data));
    assert.equal(overridden.data.dbState.overrides[0].reason, reason);
    await assert.rejects(access(marker));
    assert.ok(overridden.data.reportMd.includes("Override"));
    assert.equal(
      (
        await s.request("/api/rloop/override", {
          runId: "../../other",
          slotId: "chair",
          grade: "A",
          reason: "reason",
        })
      ).status,
      404,
    );
    assert.equal(
      (await s.request("/api/rloop/runs/" + runId)).data.dbState.overrides
        .length,
      1,
    );
  } finally {
    await s.cleanup();
  }
});
test("invalid research specs fail without creating a run", async () => {
  const s = await setup();
  try {
    const r = await s.request("/api/rloop/run", {
      customSpec: { question: "today" },
    });
    assert.equal(r.status, 422);
    assert.equal((await s.request("/api/rloop/runs")).data.runs.length, 0);
  } finally {
    await s.cleanup();
  }
});
test("interrupted durable jobs are marked failed on restart", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "deeposint-restart-"));
  try {
    let store = new Store(dir);
    const job = store.startJob("ingest");
    store.close();
    store = new Store(dir);
    assert.equal(store.get<any>("jobs", job.id).status, "FAILED");
    store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("production startup requires a strong operator token", () => {
  const old = process.env.NODE_ENV;
  const token = process.env.API_TOKEN;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.API_TOKEN;
    assert.throws(configFromEnv, /API_TOKEN/);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
    if (token !== undefined) process.env.API_TOKEN = token;
  }
});
test("separate evidence paragraphs do not create ownership or cross-subject claims", () => {
  const result = extract(
    "NAME: Alice Example\n\nNAME: Bob Example\nEMAIL: bob@example.org",
    "art-test",
    "hash",
  );
  assert.ok(!result.edges.some((e) => e.sourceValue === "Alice Example"));
  assert.ok(result.edges.every((e) => e.relationship === "CO_OCCURS_WITH"));
});

test("real PDF, OCR and EXIF bytes are processed through the API", async () => {
  const { readFile } = await import("node:fs/promises");
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/media.json", import.meta.url), "utf8"),
  );
  const s = await setup();
  try {
    const pdf = await s.request("/api/ingest", {
      fileBase64: fixture.textPdf,
      title: "fixture.pdf",
    });
    assert.equal(pdf.status, 201, JSON.stringify(pdf.data));
    assert.ok(
      pdf.data.entities.some((e: any) => e.value === "pdf@example.org"),
    );
    const ocr = await s.request("/api/ocr/parse", {
      imageBase64: fixture.ocrPng,
    });
    assert.equal(ocr.status, 200, JSON.stringify(ocr.data));
    assert.ok(ocr.data.extractedText.includes("EVIDENCE TEST 12345"));
    const exif = await s.request("/api/exif/extract", {
      imageBase64: fixture.exifJpeg,
    });
    assert.equal(exif.status, 200);
    assert.equal(exif.data.exif.cameraMake, "Test Camera");
    assert.ok(exif.data.exif.latitude > 30);
    assert.ok(exif.data.exif.longitude < -97);
    const image = await s.request("/api/ingest", {
      fileBase64: fixture.exifJpeg,
      title: "gps.jpg",
      includeOcrExif: false,
    });
    assert.equal(image.status, 201);
    const gps = image.data.entities.find(
      (e: any) => e.extractionEngine === "exif_binary_parser",
    );
    assert.ok(gps);
    assert.equal(
      gps.provenance.sourceHash,
      image.data.artifact.originalSha256Hash,
    );
  } finally {
    await s.cleanup();
  }
});
