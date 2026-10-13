import { performance } from "node:perf_hooks";
import { extract, semantic } from "./extract";
import { preprocess, decodeBase64 } from "./media";
import {
  object,
  str,
  choice,
  boolean,
  uid,
  now,
  sha256,
  type Config,
} from "./core";
import { Store } from "./store";
import type { IngestedArtifact, SourceType } from "../src/types/osint";

const sources: SourceType[] = [
  "public_profile",
  "social_media",
  "corporate_registry",
  "resume_cv",
  "forum_leak",
  "media_exif",
  "court_filing",
  "git_repo",
];
export async function ingest(input: unknown, store: Store, config: Config) {
  const b = object(input);
  const title = str(b.title, "title", 500, "Ad-hoc evidence");
  const sourceType = choice(
    b.sourceType,
    "sourceType",
    sources,
    "public_profile",
  );
  const sourceUri = str(b.sourceUri, "sourceUri", 2000, "adhoc://analyst/text");
  const classificationLevel = choice(
    b.classificationLevel,
    "classificationLevel",
    [
      "UNCLASSIFIED",
      "RESTRICTED",
      "CONFIDENTIAL",
      "SECRET",
      "TOP_SECRET",
    ] as const,
    "RESTRICTED",
  );
  const useGemini = boolean(b.useGeminiNlp, "useGeminiNlp");
  const useOcr = boolean(b.includeOcrExif, "includeOcrExif", true);
  let text: string,
    original: Buffer | undefined,
    exif: Awaited<ReturnType<typeof preprocess>>["exif"];
  const warnings: string[] = [];
  if (b.fileBase64 !== undefined) original = decodeBase64(b.fileBase64);
  else text = str(b.rawContent, "rawContent", 2_000_000);
  const start = performance.now();
  const job = store.startJob("ingest");
  const trail: IngestedArtifact["provenanceTrail"] = [];
  const stage = (
    name: string,
    started: number,
    details: string,
    status: "ok" | "warn" = "ok",
  ) =>
    trail.push({
      stage: name,
      node: "backend",
      timestamp: now(),
      durationMs: Math.round(performance.now() - started),
      status,
      details,
    });
  try {
    const preStart = performance.now();
    if (original) {
      const parsed = await preprocess(original, useOcr);
      text = parsed.text;
      exif = parsed.exif;
      warnings.push(...parsed.warnings);
    }
    stage(
      "Preprocessing",
      preStart,
      original ? "Processed original file bytes" : "Accepted UTF-8 text",
    );
    const hashStart = performance.now();
    const hash = sha256(text!);
    const id = uid("art");
    stage(
      "SHA-256",
      hashStart,
      `Text SHA-256: ${hash}${original ? `; original SHA-256: ${sha256(original)}` : ""}`,
    );
    const extractionStart = performance.now();
    let result = extract(text!, id, hash);
    if (useGemini) {
      const semanticResult = await semantic(text!, id, hash, config, result);
      result = semanticResult;
      warnings.push(...semanticResult.warnings);
    }
    if (
      exif &&
      typeof exif.latitude === "number" &&
      typeof exif.longitude === "number"
    ) {
      result.entities.push({
        id: uid("ent"),
        artifactId: id,
        category: "geo",
        subType: "exif_coordinates",
        value: `${exif.latitude}, ${exif.longitude}`,
        normalizedValue: `${exif.latitude}, ${exif.longitude}`,
        confidence: 100,
        extractionEngine: "exif_binary_parser",
        metadata: {
          latitude: exif.latitude,
          longitude: exif.longitude,
          cameraModel: exif.cameraModel,
        },
        provenance: {
          sourceHash: sha256(original!),
          rawSnippet: "GPS tags parsed from original image bytes",
          extractedAt: now(),
          workerNode: "exifr",
        },
      });
    }
    stage(
      "Extraction & graph",
      extractionStart,
      `${result.entities.length} entities; ${result.edges.length} co-occurrences${warnings.length ? `; ${warnings.join(" ")}` : ""}`,
      warnings.length ? "warn" : "ok",
    );
    const artifact: IngestedArtifact = {
      id,
      title,
      sourceType,
      sourceUri,
      classificationLevel,
      rawContent: text!,
      sha256Hash: hash,
      contentByteLength: Buffer.byteLength(text!, "utf8"),
      ingestedAt: now(),
      collectorNode: "backend",
      status: "COMPLETED",
      processingTimeMs: Math.round(performance.now() - start),
      entitiesExtracted: result.entities.length,
      provenanceTrail: trail,
      ...(exif ? { exifParsed: exif } : {}),
      ...(original
        ? {
            originalSha256Hash: sha256(original),
            originalByteLength: original.length,
          }
        : {}),
      warnings,
    };
    store.saveArtifact(artifact, result.entities, result.edges, original);
    store.finishJob(job.id, "COMPLETED", { artifactId: id });
    return { success: true, artifact, ...result, warnings, jobId: job.id };
  } catch (err) {
    store.finishJob(job.id, "FAILED", {
      error: err instanceof Error ? err.message : "Processing failed",
    });
    throw err;
  }
}
