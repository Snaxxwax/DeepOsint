import {
  object,
  str,
  choice,
  boolean,
  uid,
  now,
  sha256,
  ApiError,
  type Config,
} from "./core";
import { ingest } from "./pipeline";
import { decodeBase64 } from "./media";
import { Store } from "./store";
import type {
  SeedIdentifier,
  InvestigationDossier,
  DeepWebHit,
  ExtractedEntity,
  RelationalEdge,
} from "../src/types/osint";

export type SearchHit = { url: string; title: string; snippet: string };
export async function search(
  query: string,
  count: number,
  config: Config,
): Promise<SearchHit[]> {
  let url: string, init: RequestInit;
  if (config.searchProvider === "none") return [];
  if (config.searchProvider === "searxng") {
    const u = new URL("search", config.searxngUrl!.replace(/\/?$/, "/"));
    u.searchParams.set("q", query);
    u.searchParams.set("format", "json");
    url = u.toString();
    init = {};
  } else if (config.searchProvider === "brave") {
    url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    init = {
      headers: {
        "X-Subscription-Token": config.searchKey!,
        Accept: "application/json",
      },
    };
  } else {
    url = "https://api.tavily.com/search";
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.searchKey,
        query,
        max_results: count,
        search_depth: "basic",
      }),
    };
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(502, "Search provider request failed");
  }
  if (!response.ok)
    throw new ApiError(502, `Search provider returned HTTP ${response.status}`);
  // Bound provider data even if the provider sends no Content-Length.
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (!reader) throw new ApiError(502, "Empty provider response");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new ApiError(502, "Provider response too large");
    }
    chunks.push(value);
  }
  let data: any;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ApiError(502, "Invalid search provider response");
  }
  const rows =
    config.searchProvider === "brave" ? data.web?.results : data.results;
  return (Array.isArray(rows) ? rows : []).slice(0, count).flatMap((r: any) => {
    if (typeof r.url !== "string") return [];
    try {
      if (!["http:", "https:"].includes(new URL(r.url).protocol)) return [];
    } catch {
      return [];
    }
    return [
      {
        url: r.url.slice(0, 2000),
        title: String(r.title || r.url).slice(0, 500),
        snippet: String(r.content || r.description || r.snippet || "").slice(
          0,
          5000,
        ),
      },
    ];
  });
}
function classify(v: string): SeedIdentifier["inferredType"] {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  if (/^[+()\d .-]+$/.test(v) && v.replace(/\D/g, "").length >= 7)
    return "phone";
  if (v.includes(" ")) return "name";
  return "username";
}
export async function investigate(
  input: unknown,
  store: Store,
  config: Config,
  providerSearch = search,
) {
  const b = object(input);
  if (
    !Array.isArray(b.identifiers) ||
    !b.identifiers.length ||
    b.identifiers.length > 10
  )
    throw new ApiError(400, "Provide 1–10 identifiers");
  const seeds: SeedIdentifier[] = b.identifiers.map((v: any) => {
    const val = typeof v === "string" ? v : object(v).value;
    const value = str(val, "identifier", 200).trim();
    const type =
      typeof v === "string"
        ? "auto"
        : choice(
            v.type,
            "identifier type",
            [
              "auto",
              "name",
              "email",
              "phone",
              "license_plate",
              "username",
            ] as const,
            "auto",
          );
    return {
      id: uid("seed"),
      value,
      type,
      inferredType: type === "auto" ? classify(value) : type,
    };
  });
  const depth = choice(
    b.searchDepth,
    "searchDepth",
    ["fast", "deep", "comprehensive"] as const,
    "deep",
  );
  const includeOcrExif = boolean(b.includeOcrExif, "includeOcrExif", true);
  const useGemini = boolean(b.useGeminiNlp, "useGeminiNlp");
  const files = b.companionFiles ?? [];
  if (!Array.isArray(files) || files.length > 10)
    throw new ApiError(400, "At most 10 companion files are allowed");
  // Validate all uploads before any provider request or persistence.
  const uploads = files.map((f: any) => {
    const v = object(f);
    if (v.fileBase64 !== undefined) decodeBase64(v.fileBase64);
    return {
      name: str(v.name, "file name", 200, "Evidence"),
      content:
        v.fileBase64 !== undefined
          ? undefined
          : str(v.content, "file content", 2_000_000),
      fileBase64: v.fileBase64,
    };
  });
  if (config.searchProvider === "none" && !uploads.length)
    throw new ApiError(
      503,
      "No search provider configured. Configure SEARCH_PROVIDER or attach evidence.",
    );
  const queries = seeds.flatMap((s) => {
    const q = `"${s.value.replace(/["\\]/g, " ")}"`;
    return depth === "fast"
      ? [q]
      : depth === "deep"
        ? [q, `${q} profile`]
        : [q, `${q} profile`, `${q} site:github.com`];
  });
  const job = store.startJob("investigation");
  try {
    const hits: DeepWebHit[] = [];
    const entities: ExtractedEntity[] = [];
    const edges: RelationalEdge[] = [];
    const artifactIds: string[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    for (const query of queries)
      for (const result of await providerSearch(
        query,
        depth === "fast" ? 3 : 5,
        config,
      )) {
        if (seen.has(result.url) || !result.snippet.trim()) continue;
        seen.add(result.url);
        const saved = await ingest(
          {
            title: result.title,
            rawContent: result.snippet,
            sourceType: "public_profile",
            sourceUri: result.url,
            useGeminiNlp: useGemini,
          },
          store,
          config,
        );
        artifactIds.push(saved.artifact.id);
        entities.push(...saved.entities);
        edges.push(...saved.edges);
        warnings.push(...saved.warnings);
        hits.push({
          id: uid("hit"),
          source: `${config.searchProvider} search snippet`,
          sourceType: "public_web",
          title: result.title,
          leakDate: saved.artifact.ingestedAt,
          snippet: result.snippet,
          matchedIdentifiers: seeds
            .filter((s) =>
              result.snippet.toLowerCase().includes(s.value.toLowerCase()),
            )
            .map((s) => s.value),
          onionMirror: result.url,
          sha256: saved.artifact.sha256Hash,
          threatLevel: "UNKNOWN",
          artifactId: saved.artifact.id,
          evidenceScope: "search_snippet",
        });
      }
    for (const file of uploads) {
      const saved = await ingest(
        {
          title: file.name,
          rawContent: file.content,
          fileBase64: file.fileBase64,
          sourceUri: `upload://${encodeURIComponent(file.name)}`,
          sourceType: "public_profile",
          includeOcrExif,
          useGeminiNlp: useGemini,
        },
        store,
        config,
      );
      artifactIds.push(saved.artifact.id);
      entities.push(...saved.entities);
      edges.push(...saved.edges);
      warnings.push(...saved.warnings);
      hits.push({
        id: uid("hit"),
        source: "Analyst upload",
        sourceType: "analyst_upload",
        title: file.name,
        leakDate: saved.artifact.ingestedAt,
        snippet: saved.artifact.rawContent.slice(0, 5000),
        matchedIdentifiers: seeds
          .filter((s) =>
            saved.artifact.rawContent
              .toLowerCase()
              .includes(s.value.toLowerCase()),
          )
          .map((s) => s.value),
        sha256: saved.artifact.sha256Hash,
        threatLevel: "UNKNOWN",
        artifactId: saved.artifact.id,
        evidenceScope: "uploaded_file",
      });
    }
    const dossier: InvestigationDossier = {
      id: uid("investigation"),
      targetQuery: seeds.map((s) => s.value).join(", "),
      seedIdentifiers: seeds,
      queriesFormulated: queries,
      totalHits: hits.length,
      hits,
      extractedEntities: entities,
      extractedEdges: edges,
      timestamp: now(),
      coOccurrences: edges.map((e) => ({
        identifierA: e.sourceValue,
        identifierB: e.targetValue,
        correlationStrength: e.confidence,
        evidence: e.evidence,
      })),
      reasoningSummary: `Collected ${hits.length} evidence records; extracted ${entities.length} identifiers and ${edges.length} co-occurrences. Search evidence contains provider snippets; source pages were not fetched. Co-occurrence does not establish identity or ownership. No Tor, breach database or ALPR connector is configured.`,
      auditHash: sha256(
        JSON.stringify(
          hits.map((h) => ({ artifactId: h.artifactId, sha256: h.sha256 })),
        ),
      ),
      artifactIds,
      warnings: [...new Set(warnings)],
    };
    store.saveDossier(dossier);
    store.finishJob(job.id, "COMPLETED", { investigationId: dossier.id });
    return { success: true, dossier, jobId: job.id };
  } catch (err) {
    store.finishJob(job.id, "FAILED", {
      error: err instanceof Error ? err.message : "Investigation failed",
    });
    throw err;
  }
}
