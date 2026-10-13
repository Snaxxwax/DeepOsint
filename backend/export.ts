import { randomUUID } from "node:crypto";
import type {
  ExtractedEntity,
  RelationalEdge,
  IngestedArtifact,
} from "../src/types/osint";

export function stix(
  entities: ExtractedEntity[],
  edges: RelationalEdge[],
  artifact?: IngestedArtifact,
) {
  const timestamp = new Date().toISOString();
  const ids = new Map<string, string>();
  const objects: any[] = [];
  for (const e of entities) {
    let type = "x-deeposint-entity",
      attrs: Record<string, unknown> = {
        name: e.value,
        x_category: e.category,
        x_subtype: e.subType,
      };
    if (e.subType === "full_name" || e.subType === "organization") {
      type = "identity";
      attrs = {
        name: e.value,
        identity_class:
          e.subType === "full_name" ? "individual" : "organization",
      };
    } else if (e.subType === "email") {
      type = "email-addr";
      attrs = { value: e.value };
    } else if (e.subType === "ipv4" || e.subType === "ipv6") {
      type = `${e.subType}-addr`;
      attrs = { value: e.value };
    } else if (e.subType === "domain") {
      type = "domain-name";
      attrs = { value: e.value };
    } else if (e.subType === "url") {
      type = "url";
      attrs = { value: e.value };
    } else if (e.category === "social_footprint") {
      type = "user-account";
      attrs = { account_login: e.value };
    }
    const id = `${type}--${randomUUID()}`;
    ids.set(e.id, id);
    const sdo = type === "identity" || type.startsWith("x-");
    objects.push({
      type,
      spec_version: "2.1",
      id,
      ...(sdo
        ? { created: timestamp, modified: timestamp, confidence: e.confidence }
        : {}),
      ...attrs,
      x_source_hash: e.provenance.sourceHash,
      x_artifact_id: e.artifactId,
      x_extraction_engine: e.extractionEngine,
    });
  }
  for (const e of edges) {
    const source = ids.get(e.sourceEntityId),
      target = ids.get(e.targetEntityId);
    if (!source || !target) continue;
    // Custom relationship keeps source evidence without implying unsupported STIX semantics.
    objects.push({
      type: "relationship",
      spec_version: "2.1",
      id: `relationship--${randomUUID()}`,
      created: timestamp,
      modified: timestamp,
      relationship_type: e.relationship.toLowerCase().replaceAll("_", "-"),
      source_ref: source,
      target_ref: target,
      confidence: e.confidence,
      description: e.evidence,
    });
  }
  if (objects.length)
    objects.unshift({
      type: "report",
      spec_version: "2.1",
      id: `report--${randomUUID()}`,
      created: timestamp,
      modified: timestamp,
      name: artifact?.title || "DeepOsint evidence export",
      published: timestamp,
      report_types: ["threat-report"],
      object_refs: objects.map((o) => o.id),
    });
  return { type: "bundle", id: `bundle--${randomUUID()}`, objects };
}
export function csv(entities: ExtractedEntity[]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return [
    [
      "Category",
      "Subtype",
      "Value",
      "Confidence",
      "SourceHash",
      "ArtifactId",
      "Snippet",
    ],
    ...entities.map((e) => [
      e.category,
      e.subType,
      e.value,
      e.confidence,
      e.provenance.sourceHash,
      e.artifactId,
      e.provenance.rawSnippet,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
