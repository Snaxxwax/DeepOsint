import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { now, uid } from "./core";
import type {
  IngestedArtifact,
  ExtractedEntity,
  RelationalEdge,
  InvestigationDossier,
} from "../src/types/osint";

export class Store {
  db: DatabaseSync;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dataDir, "deeposint.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, hash TEXT NOT NULL, json TEXT NOT NULL, original BLOB);
      CREATE INDEX IF NOT EXISTS artifact_hash ON artifacts(hash);
      CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id), json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS entity_artifact ON entities(artifact_id);
      CREATE TABLE IF NOT EXISTS edges(id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES entities(id), target_id TEXT NOT NULL REFERENCES entities(id), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS investigations(id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      PRAGMA user_version=1;`);
    // Requests interrupted by a process exit remain visible, never silently marked completed.
    for (const job of this.all<any>("jobs").filter(
      (j) => j.status === "RUNNING",
    ))
      this.finishJob(job.id, "FAILED", {
        error: "Server restarted during processing",
      });
  }
  close() {
    this.db.close();
  }
  all<T>(
    table: "artifacts" | "entities" | "edges" | "investigations" | "jobs",
  ): T[] {
    return this.db
      .prepare(`SELECT json FROM ${table} ORDER BY rowid DESC`)
      .all()
      .map((r) => JSON.parse(r.json as string));
  }
  get<T>(
    table: "artifacts" | "investigations" | "jobs",
    id: string,
  ): T | undefined {
    const r = this.db.prepare(`SELECT json FROM ${table} WHERE id=?`).get(id);
    return r ? JSON.parse(r.json as string) : undefined;
  }
  saveArtifact(
    artifact: IngestedArtifact,
    entities: ExtractedEntity[],
    edges: RelationalEdge[],
    original?: Buffer,
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT INTO artifacts VALUES(?,?,?,?)")
        .run(
          artifact.id,
          artifact.sha256Hash,
          JSON.stringify(artifact),
          original || null,
        );
      const insertEntity = this.db.prepare(
        "INSERT INTO entities VALUES(?,?,?)",
      );
      for (const e of entities)
        insertEntity.run(e.id, artifact.id, JSON.stringify(e));
      const insertEdge = this.db.prepare("INSERT INTO edges VALUES(?,?,?,?)");
      for (const e of edges)
        insertEdge.run(
          e.id,
          e.sourceEntityId,
          e.targetEntityId,
          JSON.stringify(e),
        );
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
  original(id: string): Buffer | undefined {
    const r = this.db
      .prepare("SELECT original FROM artifacts WHERE id=?")
      .get(id);
    return r?.original ? Buffer.from(r.original as Uint8Array) : undefined;
  }
  saveDossier(dossier: InvestigationDossier) {
    this.db
      .prepare("INSERT INTO investigations VALUES(?,?)")
      .run(dossier.id, JSON.stringify(dossier));
  }
  startJob(kind: string, extra: object = {}) {
    const job = {
      id: uid("job"),
      kind,
      status: "RUNNING",
      createdAt: now(),
      ...extra,
    };
    this.db
      .prepare("INSERT INTO jobs VALUES(?,?,?,?)")
      .run(job.id, kind, job.status, JSON.stringify(job));
    return job;
  }
  finishJob(id: string, status: "COMPLETED" | "FAILED", extra: object) {
    const j = this.get<any>("jobs", id);
    this.db
      .prepare("UPDATE jobs SET status=?,json=? WHERE id=?")
      .run(
        status,
        JSON.stringify({ ...j, ...extra, status, finishedAt: now() }),
        id,
      );
  }
  snapshot() {
    return {
      artifacts: this.all<IngestedArtifact>("artifacts"),
      entities: this.all<ExtractedEntity>("entities"),
      edges: this.all<RelationalEdge>("edges"),
      investigations: this.all<InvestigationDossier>("investigations"),
    };
  }
}
