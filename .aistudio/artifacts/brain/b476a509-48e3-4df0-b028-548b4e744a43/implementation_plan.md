# Automated OSINT Ingestion & Entity-Extraction Pipeline

An automated intelligence ingestion, extraction, and graph correlation platform featuring an interactive **Deep & Dark Web Investigation Engine**. Analysts can input one or more seed identifiers—such as **names**, **emails**, **phone numbers**, **license plates**, or **usernames**—and trigger autonomous deep-search, AI reasoning, multi-source correlation (PDF archives, breach dumps, forum leaks, code repos, media files), entity extraction, and relational graph mapping with audit-ready provenance.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions incorporate user feedback and Phase 1 interactive scoping:
> - **Identifier-Driven Deep Search Input**: Analysts can enter one or multiple seed identifiers simultaneously (e.g., Target Name + Username, or Email + Phone Number, or Vehicle License Plate).
> - **Multi-Source Deep & Dark Web Search Pipeline**:
>   - **Search Query Expansion**: Automatically formulates structured intelligence queries, search dorks, and breach archive signatures for the entered identifiers.
>   - **Deep & Dark Web Intelligence Correlator**: Queries public intelligence indexes, pastebin archives, breach dumps, code repositories, forum leak datasets, and deep-web onion mirror feeds.
>   - **Gemini Reasoning & Disambiguation**: Uses `gemini-3.8-flash` reasoning to cross-reference hits, resolve aliases, discard false positives, and link disparate data points into a cohesive profile.
> - **Extracted Entity Taxonomy**:
>   - **Names & Monikers**: Legal names, forum handles, aliases, maiden names.
>   - **Emails**: Normalized addresses, domain records, linked gravatars.
>   - **Phone Numbers**: Cleaned international E.164 numbers, carrier metadata, VoIP flags.
>   - **License Plates**: Vehicle registration tags, state/region tags, vehicle make/model associations.
>   - **Usernames**: Social handles, forum accounts, code repository logins.
>   - **Geospatial & EXIF**: GPS coordinates, physical street addresses, camera metadata.
> - **Multi-Source Document Intake Queue**: Complements live search with direct multi-file drag-and-drop for local PDF dumps, image files (with OCR and EXIF), and code archives.
> - **Interactive Force-Directed Graph**: Maps discovered relationships (`OPERATES_HANDLE`, `USES_PHONE`, `USES_EMAIL`, `DRIVES_VEHICLE_PLATE`, `CO_OCCURS_WITH`) in real time.

---

## 1. Overview & Core Concept

### What It Does
The platform provides a dual-mode OSINT intelligence workbench:
1. **Targeted Deep & Dark Web Investigation Console**:
   - The investigator enters one or more seed identifiers (e.g., `john.doe@proton.me`, `handle: ShadowCoder99`, `plate: CA 7XYZ890`, `phone: +1-555-0199`).
   - The engine generates targeted search queries across deep web and dark web leak repositories, forum dumps, breach datasets, and public indexes.
   - Advanced AI reasoning synthesizes the search results, discovering co-occurring identifiers, associated profiles, and exposure points.
2. **Multi-Source File & Artifact Intake**:
   - Analysts can upload companion evidence: PDF documents, photographs (with EXIF GPS coordinates and license plate OCR), and code files.
3. **Automated Entity & Relationship Extraction**:
   - Extracts and normalizes all discovered personal identifiers: names, emails, phone numbers, license plates, usernames, and physical locations.
4. **Interactive Force-Directed Persona Graph**:
   - Visually clusters entities around the target subject, showing exact connection paths and link confidence scores.
5. **Audit-Ready Provenance & Export**:
   - Every finding includes cryptographic source hashing (SHA-256), exact raw context snippets, timestamped extraction logs, and one-click STIX 2.1 / CSV export.

### Target Audience & Persona
- **OSINT Investigators, Security Researchers, and Intelligence Analysts**: Conducting persona attribution, breach exposure analysis, and background investigations.

### Key Value
Eliminates manual pivoting between disparate search engines, breach archives, and leak pastes by providing an automated query, reasoning, and graph-correlation pipeline from seed identifiers to final intelligence dossier.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│  Identifier Search & Intake Dock│     │  Deep Web & AI Reasoning Loop   │     │  Interactive Persona Graph      │
│  - Enter Name/Email/Phone/Plate │────>│  - Query expansion & leak search│────>│  - Visual link analysis         │
│  - Drag & drop companion files  │     │  - Multimodal OCR & EXIF parse  │     │  - Node inspector & audit drawer│
│  - Select pre-loaded scenarios  │     │  - Gemini reasoning & NER       │     │  - Category filtering           │
└─────────────────────────────────┘     └─────────────────────────────────┘     └───────────────┬─────────────────┘
                                                                                                │
                                                                                                ▼
                                                                                ┌─────────────────────────────────┐
                                                                                │    Intelligence Dossier Export  │
                                                                                │  - STIX 2.1 Defense Bundle      │
                                                                                │  - Verifiable evidence snippets │
                                                                                │  - Cryptographic audit trail    │
                                                                                └─────────────────────────────────┘
```

1. **Investigation Console (Primary View)**:
   - **Seed Identifier Intake Bar**: Flexible multi-tag input where analysts type or paste 1 or more seed identifiers (e.g., Name, Email, Phone, License Plate, Username) with automatic type detection.
   - **Investigation Depth Selector**: Configurable search breadth (Quick Triage, Deep Web & Breach Search, Full Multimodal Investigation with Companion Files).
   - **Quick-Start Scenarios**: One-click investigation presets (e.g., *Subject Surveillance & Vehicle Dossier*, *Dark Web Forum Account Leak*, *Breached Executive Persona*).
2. **Real-Time Reasoning & Progress Terminal**:
   - Displays live pipeline stages: `Query Expansion` → `Dark Web Repository Search` → `OCR & EXIF Extraction` → `Gemini AI Correlation & Disambiguation` → `Graph Construction`.
3. **Identifier Ledger Grid**:
   - Clean, tabular ledger grouped into tabs: **Names & Aliases**, **Emails**, **Phone Numbers**, **License Plates**, **Usernames**, **Geospatial & EXIF**, **Financials**.
   - Tabular figures (`tabular-nums`) with confidence ratings, discovery source tags, and audit buttons.
4. **Interactive Persona Graph**:
   - Force-directed physics canvas centering on the target and expanding out to connected identifiers (phone, email, plate, handle).
   - Selecting any node reveals its connection hierarchy, risk score, and supporting evidence snippet.
5. **Geospatial Map & Media EXIF Viewer**:
   - Pinpoints extracted GPS coordinates from photos, sightings, and vehicle locations on an interactive map.
6. **Provenance & STIX 2.1 Export**:
   - Full chain-of-custody viewer with source SHA-256 hashes, exact context quotes, and one-click JSON STIX 2.1 download.

### Visual Identity & Theme
- **Aesthetic Direction**: High-density intelligence analyst workstation adhering to anti-slop guidelines. Flat, single-elevation surfaces with hairline borders (`border-slate-800`) on an obsidian dark slate canvas (`#0B132B`, `#0F172A`).
- **Color Palette & Distribution**:
  - `60% Neutral Canvas`: Deep slate (`#0B132B`, `#0F172A`, `#1E293B`).
  - `30% Structural Panels`: Flat card containers and divider lines (`#111C38`).
  - `10% Identifier Accents`:
    - Cyan (`#06B6D4`): Usernames and online handles.
    - Emerald (`#10B981`): Names and confirmed identities.
    - Amber (`#F59E0B`): License plates and vehicle markers.
    - Sky (`#38BDF8`): Phone numbers and email vectors.
    - Purple (`#A855F7`): Geospatial coordinates and EXIF GPS tags.
- **Typography & Hierarchy**:
  - Headings: `Plus Jakarta Sans` / `Outfit` with clean title case.
  - Body & Metadata: Clean, unboxed text with subtle typographic separators (`·`, `/`). Zero static pill badge clutter.
  - Data & Numbers: Monospace tabular numerals (`font-mono tabular-nums`, `JetBrains Mono`) for plates, phone numbers, hashes, and coordinates.
- **Top Bar Contract**:
  - Zone 1: `Remix IntelFlow` (single text wordmark).
  - Zone 2: Navigation tabs (`Investigation Console`, `Identifier Ledger`, `Relational Graph`, `Geospatial Map`, `Provenance Audit`).
  - Zone 3: Primary action button (`Export STIX 2.1`).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Seed Identifier Input with Query Expansion
- **Chosen Approach**: Allow analysts to enter 1 or more seed identifiers (e.g. email, plate, handle), automatically infer identifier types, and generate structured search queries for deep web and dark web indexes.
- **Why**: Investigators rarely start with raw document dumps; they usually start with an email address, a vehicle plate from surveillance footage, or a forum username, and need the system to pivot outward.
- **Alternatives Considered**: File-upload-only workflow (too restrictive for rapid investigative queries).

### Decision 2: AI Reasoning Loop for Multi-Source Disambiguation
- **Chosen Approach**: Use `gemini-3.8-flash` as an autonomous reasoning agent to analyze search hits, identify common nexus points across disparate datasets (e.g., verifying that `@ShadowCoder` on GitHub and `ShadowCoder99` on a dark web forum share an email address), and synthesize relational edges.
- **Why**: Unstructured search dumps contain immense noise and false positives; AI reasoning validates co-occurrence and produces clean entity graphs.

### Decision 3: Multimodal Processing (OCR + EXIF + Regex)
- **Chosen Approach**:
  - Binary EXIF parser for extracting GPS coordinates, camera tags, and creation dates from uploaded photos.
  - OCR parser for recognizing vehicle license plates and document text.
  - Deterministic regex for phone numbers, emails, crypto wallets, and plate formats.

---

## 4. Technical Architecture & Data Strategy

### System & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Remix IntelFlow Web UI                          │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Identifier   │  │ Identifier   │  │ Persona Link │  │ Geospatial │  │
│  │ Search Bar   │  │ Ledger Grid  │  │ Force Graph  │  │ EXIF Map   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                │         │
│         └─────────────────┴────────┬────────┴────────────────┘         │
│                                    ▼                                   │
│                        Investigation State Store                       │
│             (Seed Inputs, Discovered Entities, Relational Edges)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTP API
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Express Backend Server (/server.ts)                 │
│                                                                        │
│  ┌──────────────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │ /api/search/investigate /api/ocr/parse    │  │ /api/exif/extract │  │
│  │ - Seed query triage  │  │ - Plate OCR     │  │ - Binary EXIF GPS │  │
│  │ - Deep/dark web feed │  │ - Scanned text  │  │ - Camera metadata │  │
│  └──────────┬───────────┘  └────────┬────────┘  └─────────┬─────────┘  │
│             │                       │                     │            │
│             └───────────────────────┼─────────────────────┘            │
│                                     ▼                                  │
│                 ┌───────────────────────────────────────┐              │
│                 │ /api/gemini/reason-and-correlate      │              │
│                 │ - gemini-3.8-flash Multi-Step Agent   │              │
│                 │ - Disambiguation & Relation Synthesis │              │
│                 │ - Name/Email/Phone/Plate/Handle Extr. │              │
│                 └───────────────────┬───────────────────┘              │
│                                     ▼                                  │
│                 ┌───────────────────────────────────────┐              │
│                 │ /api/export/stix                      │              │
│                 │ - STIX 2.1 Identity & Location Bundle │              │
│                 └───────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────────┘
```

### Key API Endpoints
- **`POST /api/search/investigate`**: Accepts `{ identifiers: string[], depth: string }`. Runs query expansion across indexed deep/dark web leak datasets, pastebins, and forums.
- **`POST /api/gemini/reason-and-correlate`**: Uses `gemini-3.8-flash` to evaluate search hits, execute identity attribution reasoning, extract personal entities (names, emails, phones, plates, usernames), and construct verified relational links.
- **`POST /api/ocr/parse`**: Performs character recognition on uploaded images/documents (e.g., license plates, badges, IDs).
- **`POST /api/exif/extract`**: Extracts binary EXIF GPS coordinates, camera hardware models, and timestamps from uploaded media.
- **`POST /api/export/stix`**: Formats all investigated entities and edges into OASIS STIX 2.1 standard JSON.

### Interactive State Transitions
1. Analyst enters one or more identifiers (e.g., email or license plate) and clicks **"Launch Deep Search"**.
2. Investigation pipeline animates progress through search, OCR/EXIF, and Gemini reasoning.
3. System populates the **Identifier Ledger** and builds the **Persona Force Graph**.
4. Analyst interacts with nodes to inspect direct links, review raw source evidence snippets, and export findings to STIX 2.1 or CSV.
