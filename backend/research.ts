import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile, rm, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { object, str, choice, boolean, ApiError, type Config } from "./core";
import { Store } from "./store";

const execute = promisify(execFile);
const mutations = new Set<string>();
const root = path.resolve(import.meta.dirname, "../research-loop");
async function python(config: Config, args: string[], timeout = 15000) {
  try {
    return await execute(config.python, args, {
      cwd: root,
      env: { ...process.env, PYTHONPATH: root },
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (err: any) {
    if (err.code === "ENOENT")
      throw new ApiError(503, "Python runtime unavailable");
    if (err.killed) throw new ApiError(504, "Research execution timed out");
    // Bridge validation errors are explicit; do not disclose stack traces, paths or credentials.
    let message = "Research execution failed";
    try {
      message =
        JSON.parse(err.stdout.trim().split("\n").at(-1)).error || message;
    } catch {}
    throw new ApiError(422, message.slice(0, 500));
  }
}
async function requestFile(
  config: Config,
  request: object,
  fn: (file: string) => Promise<any>,
) {
  await mkdir(path.join(config.dataDir, "temp"), {
    recursive: true,
    mode: 0o700,
  });
  const dir = await mkdtemp(path.join(config.dataDir, "temp", "request-"));
  const file = path.join(dir, "request.json");
  try {
    await writeFile(file, JSON.stringify(request), { mode: 0o600 });
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export async function defaultSpec() {
  return JSON.parse(
    await readFile(path.join(root, "examples/fed_chair.spec.json"), "utf8"),
  );
}
export async function validateResearch(spec: unknown, config: Config) {
  object(spec);
  await requestFile(config, { spec }, (f) =>
    python(config, ["-m", "rloop.api_bridge", "validate", f]),
  );
}
export async function runResearch(
  input: unknown,
  store: Store,
  config: Config,
) {
  const b = object(input);
  const provider = choice(
    b.provider,
    "provider",
    ["fixture", "brave", "tavily"] as const,
    "fixture",
  );
  const watch = boolean(b.watch, "watch");
  const resume = boolean(b.resume, "resume");
  if (b.specId !== undefined && b.specId !== "fed_chair")
    throw new ApiError(400, "Unknown specId");
  if (
    (provider === "brave" && !process.env.BRAVE_API_KEY) ||
    (provider === "tavily" && !process.env.TAVILY_API_KEY)
  )
    throw new ApiError(503, "Research provider API key is not configured");
  let job: any;
  if (resume) {
    const runId = str(b.runId, "runId");
    job = store
      .all<any>("jobs")
      .find((j) => j.kind === "research" && j.id === runId);
    if (!job) throw new ApiError(404, "Research run not found");
    if (job.status === "RUNNING" || mutations.has(job.id))
      throw new ApiError(409, "Research run is already running");
    // Retain the persisted provider and spec when resuming.
    job = { ...job, status: "RUNNING" };
    store.db
      .prepare("UPDATE jobs SET status=?,json=? WHERE id=?")
      .run("RUNNING", JSON.stringify(job), job.id);
  } else {
    const spec =
      b.customSpec === undefined ? await defaultSpec() : object(b.customSpec);
    await validateResearch(spec, config);
    job = store.startJob("research", { provider, spec });
  }
  const dir = path.join(config.dataDir, "research", job.id);
  mutations.add(job.id);
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const result = await requestFile(
      config,
      {
        spec: job.spec,
        provider: job.provider,
        runId: job.id,
        db: path.join(dir, "state.sqlite"),
        output: path.join(dir, "report.md"),
        watch,
      },
      (f) => python(config, ["-m", "rloop.api_bridge", "run", f], 120000),
    );
    const data = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
    await writeFile(path.join(dir, "result.json"), JSON.stringify(data), {
      mode: 0o600,
    });
    store.finishJob(job.id, "COMPLETED", {});
    return {
      success: true,
      runId: job.id,
      execOutput: data.execOutput,
      dbState: data.dbState,
      reportMd: data.reportMd,
    };
  } catch (err) {
    store.finishJob(job.id, "FAILED", {
      error: err instanceof Error ? err.message : "Research failed",
    });
    throw err;
  } finally {
    mutations.delete(job.id);
  }
}
export async function researchResult(
  runId: string,
  store: Store,
  config: Config,
) {
  const job = store.get<any>("jobs", runId);
  if (!job || job.kind !== "research")
    throw new ApiError(404, "Research run not found");
  try {
    return {
      ...JSON.parse(
        await readFile(
          path.join(config.dataDir, "research", job.id, "result.json"),
          "utf8",
        ),
      ),
      runId: job.id,
      status: job.status,
    };
  } catch {
    return { runId: job.id, status: job.status, error: job.error };
  }
}
export async function overrideResearch(
  input: unknown,
  store: Store,
  config: Config,
) {
  const b = object(input);
  const runId = str(b.runId, "runId");
  const slotId = str(b.slotId, "slotId", 100);
  const grade = choice(b.grade, "grade", ["A", "B", "C", "D", "X"] as const);
  const reason = str(b.reason, "reason", 2000);
  const job = store.get<any>("jobs", runId);
  if (!job || job.kind !== "research")
    throw new ApiError(404, "Research run not found");
  if (job.status !== "COMPLETED")
    throw new ApiError(409, "Override requires a completed run");
  if (!job.spec.slots.some((s: any) => s.slot_id === slotId))
    throw new ApiError(400, "Unknown slot");
  if (mutations.has(job.id))
    throw new ApiError(409, "Research run is already being modified");
  mutations.add(job.id);
  try {
    const dir = path.join(config.dataDir, "research", job.id);
    const result = await requestFile(
      config,
      {
        runId,
        slotId,
        grade,
        reason,
        db: path.join(dir, "state.sqlite"),
        output: path.join(dir, "report.md"),
      },
      (f) => python(config, ["-m", "rloop.api_bridge", "override", f]),
    );
    const data = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
    await writeFile(path.join(dir, "result.json"), JSON.stringify(data), {
      mode: 0o600,
    });
    return { success: true, runId, ...data };
  } finally {
    mutations.delete(job.id);
  }
}
export async function testResearch(config: Config) {
  const { stdout, stderr } = await python(config, [
    "-m",
    "unittest",
    "discover",
    "-v",
  ]);
  const output = stdout + stderr;
  return {
    success: true,
    passed: true,
    testCount: Number(/Ran (\d+) tests?/.exec(output)?.[1] || 0),
    output,
  };
}
