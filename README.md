# DeepOsint

A single-operator OSINT workspace with persistent evidence, source-grounded entity extraction, conservative knowledge graph links, and an isolated Python research loop. The React dashboard uses the Express API for ingestion, saved state, investigations, metrics, and exports.

## Run locally

Requires Node.js **24+**, Python **3.10+**, and (for PDF/OCR) Poppler and Tesseract. Debian/Ubuntu:

```bash
sudo apt-get install python3 poppler-utils tesseract-ocr
npm ci
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:3000. A fresh workspace starts empty. Sample scenarios are available for explicit ingestion in the UI; they are fictional demonstration evidence. The research-loop dashboard is an offline reference fixture, not a live assertion about Federal Reserve leadership.

Select **Custom Dossier** to paste evidence or upload UTF-8 text/code, PDF, JPEG, or PNG. Uploads use JSON base64 with a 10 MiB binary limit and 16 MiB request limit. Text is limited to 2 million characters. Poppler extracts PDF text; Tesseract processes images and the first 10 pages of image-only PDFs. Mixed PDFs use their existing text layer without OCR of individual missing pages. JPEG/PNG metadata is parsed with exifr. Unsupported files, missing tools, and parser failures return explicit errors.

## Search and semantic extraction

Set `SEARCH_PROVIDER=brave`, `tavily`, or `searxng`, then configure the corresponding key or `SEARXNG_URL`. SearXNG must allow JSON responses. The configured endpoint is trusted operator configuration, not a user-supplied fetch target; it may point to a private SearXNG service.

Investigations collect actual **search snippets** and attached evidence. Search source pages are not fetched by the investigation endpoint. Every result records its evidence scope, acquisition timestamp, URI, artifact ID, and content hash. Search depth controls one, two, or three queries per identifier, with bounded results. With no search provider, investigation requires attached evidence. No Tor, breach-database, DMV, or ALPR service is connected.

Deterministic extraction works without credentials. `GEMINI_API_KEY` enables an optional semantic pass when requested with `useGeminiNlp=true`; source content is sent to Google for that pass. Set `GEMINI_MODEL` to a model available to your account. Model values must be exact source substrings and pass category/type checks. Failed semantic requests retain the deterministic result and record a warning. The semantic pass is limited to 30,000 characters; the deterministic pass sees the full text.

Confidence describes an extraction heuristic, not a probability that two people are the same. Graph links represent nearby **CO_OCCURS_WITH** observations within a paragraph; they do not establish ownership, residence, affiliation, or identity. EXIF coordinates represent stored metadata, not independently verified physical presence. No threat score is invented.

## Persistence and provenance

`DATA_DIR` contains `deeposint.sqlite` and isolated research-run directories. SQLite WAL and foreign keys protect completed artifact/entity/edge writes in one transaction. Original uploaded bytes are retained alongside their SHA-256; extracted text has a separate SHA-256. Hashes verify byte integrity, not source authenticity. Text offsets use JavaScript UTF-16 character indices. Binary EXIF observations point to the original byte hash. Provenance timestamps and stage durations come from actual processing.

Operations run within the HTTP request. At most two expensive requests execute at once; excess requests receive 429. Jobs are durable status records, not a background task queue. A restart marks interrupted jobs failed; it does not automatically replay them. An investigation may retain successfully collected artifacts if a later provider/file fails; the failed job records that outcome. Research runs can be resumed explicitly by ID. Keep one server process per data directory. This build is intended for a small workspace; snapshot/graph endpoints load saved records into memory.

Back up the data directory while stopped, or use SQLite's online backup facility. Storage is not application-encrypted; protect the host and backup destination. Existing demo SQLite files in `research-loop/` are not used by the backend.

## API

All routes except health and session login require authentication when `API_TOKEN` is set. CLI clients use `Authorization: Bearer <API_TOKEN>`. The browser signs in with that token through `/api/session`; its HttpOnly, SameSite=Strict cookie lasts eight hours. Tokens stay out of browser localStorage.

| Method | Route | Request / response |
| --- | --- | --- |
| GET | `/api/health` | Liveness and authentication requirement |
| POST / DELETE | `/api/session` | `{apiToken}` to sign in / sign out |
| GET | `/api/capabilities` | Configured search/semantic features |
| GET | `/api/state` | Saved artifacts, entities, edges, investigations |
| POST | `/api/ingest` | Text or file; returns artifact, entities, edges, warnings, jobId |
| GET | `/api/artifacts` | Paginated artifact list |
| GET | `/api/artifacts/:id` | Artifact with its entities and graph edges |
| GET | `/api/artifacts/:id/original` | Original bytes as an attachment |
| GET | `/api/entities` | Filter by `artifactId`, `category`, or `q` |
| GET | `/api/graph` | Saved entities and graph edges |
| GET | `/api/metrics` | Counts, measured latency/throughput, process memory |
| POST | `/api/search/investigate` | Seed identifiers, searchDepth, companionFiles |
| GET | `/api/investigations` | Paginated dossier list |
| GET | `/api/investigations/:id` | Saved dossier |
| GET | `/api/jobs` / `/api/jobs/:id` | Durable operation status |
| POST | `/api/gemini/extract-entities` | `{artifactId}`; extraction preview from stored content |
| POST | `/api/ocr/parse` | `{imageBase64}` / `{fileBase64}` / `{textContent}` |
| POST | `/api/exif/extract` | `{imageBase64}` or `{fileBase64}` |
| POST | `/api/provenance/verify` | `{artifactId, rawContent?}` or `{rawContent, expectedSha256}`; `original:true` verifies retained bytes |
| POST | `/api/export/stix` / `/api/export/csv` | `{artifactId?}`; exports saved data |
| GET | `/api/rloop/specs` | Reference research spec |
| POST | `/api/rloop/validate` | `{spec}` |
| POST | `/api/rloop/run` | `{provider, customSpec?, watch?}` or `{resume:true, runId}` |
| GET | `/api/rloop/runs` / `/api/rloop/runs/:id` | Research status and saved report/state |
| POST | `/api/rloop/override` | `{runId, slotId, grade, reason}` |
| GET | `/api/rloop/tests` | Runs offline tests; development only |

Paginated routes accept `offset` (default 0) and `limit` (default 50, maximum 200). Ingestion returns 201; successful research returns 200. Errors return JSON `{error}` with 400/401/403/404/409/413/415/422/429/502/503/504 as appropriate. Provider timeouts and parser limits are explicit; public API responses omit server stack traces and provider credentials.

Example ingestion:

```bash
curl http://127.0.0.1:3000/api/ingest \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Evidence notes","sourceType":"public_profile","sourceUri":"adhoc://analyst/notes","rawContent":"NAME: Alice Example\nEMAIL: alice@example.org"}'
```

Investigation body:

```json
{
  "identifiers": [{"value": "alice@example.org", "type": "email"}],
  "searchDepth": "fast",
  "includeOcrExif": true,
  "useGeminiNlp": false,
  "companionFiles": [{"name": "notes.txt", "content": "EMAIL: alice@example.org"}]
}
```

Identifier types are `auto`, `name`, `email`, `phone`, `license_plate`, or `username`. String identifiers remain supported. Companion files can instead supply `fileBase64`. Metadata ingestion supports the source types and classification levels in `src/types/osint.ts`.

STIX exports use valid UUID IDs, supported observable types, relationships with resolvable references, and `x-deeposint-entity` custom objects for unsupported identifiers. Consumers must permit custom objects/properties. CSV cells are quoted, quotes escaped, and formula-like values prefixed with an apostrophe.

## Research loop

`fixture` is offline reference replay. `brave` and `tavily` use their server-side keys. Each run gets its own SQLite database, report, spec, provider, and UUID run ID. Overrides retain literal written reasons and regenerate the report. Subprocesses use argument arrays, never shell interpolation. Live page fetching validates schemes and public IPs, pins DNS results to the connection, revalidates redirects, limits response size, honors robots.txt, and spaces same-host requests. Failing robots retrieval blocks the page. Research execution has a 120-second request budget; lengthy live runs can fail and be explicitly resumed.

`watch:true` records a decay recheck date in the research database. No autonomous scheduler or notification service is installed.

## Production

```bash
npm run build
NODE_ENV=production API_TOKEN=<at-least-32-characters> HOST=0.0.0.0 npm start
```

Use HTTPS through a reverse proxy that preserves the original Host header; browser session cookies are Secure in production. API keys stay server-side. This is one operator workspace with a shared token, not multi-user RBAC. Production startup refuses an absent/short token. Do not expose an unauthenticated development server externally.

For a container build:

```bash
docker build -t deeposint .
# Set API_TOKEN in .env first; bind a persistent data volume.
docker run --init --memory=2g --cpus=2 --env-file .env \
  -e NODE_ENV=production -e HOST=0.0.0.0 -e DATA_DIR=/app/data \
  -v deeposint-data:/app/data -p 127.0.0.1:3000:3000 deeposint
```

Place the container behind your HTTPS proxy for browser access. Original evidence and subprocesses stay on the container's local filesystem.

## Validation

```bash
npm run lint
npm run build
npm test
npm run test:research
```

The API suite includes real Poppler, Tesseract, and EXIF fixtures, persistence/reopen checks, authentication, tampering, exports, provider deduplication, isolated concurrent research, resume, and shell-syntax override regression coverage. The Python suite covers the original research loop plus network guards and completed-run resume. CI installs media tools and runs both suites. Live commercial search and Gemini calls require credentials and are not exercised by offline CI.
