import { IngestedArtifact } from '../types/osint';
import { computePseudoSha256, parseExifMetadata } from './extractor';

export interface PreloadedDataset {
  id: string;
  title: string;
  sourceType: IngestedArtifact['sourceType'];
  classificationLevel: IngestedArtifact['classificationLevel'];
  sourceUri: string;
  description: string;
  rawContent: string;
}

export const PRELOADED_DATASETS: PreloadedDataset[] = [
  {
    id: 'poi-001',
    title: 'Executive Due Diligence & Corporate Shell Directorships',
    sourceType: 'corporate_registry',
    classificationLevel: 'CONFIDENTIAL',
    sourceUri: 'https://companieshouse.gov.uk/officers/vance-marcus-0941/filings.txt',
    description: 'Companies House public filing cross-referenced with executive bio, corporate email, London registered office, and linked offshore holdings.',
    rawContent: `--- UK COMPANIES HOUSE & CORPORATE DUE DILIGENCE DOSSIER ---
FILING_REF: CH-2026-08194
TARGET_NAME: Marcus Vance
FULL_NAME: Marcus Vance
ALIAS: @mvance_vc
ROLE: Managing Director & Executive Partner
ORGANIZATION: Vance Capital Holdings
SECONDARY_COMPANY: Apex Shell Logistics Ltd
STATUS: Active Directorship

CONTACT_VECTORS:
  PRIMARY_EMAIL: m.vance@vance-holdings.co.uk
  PERSONAL_EMAIL: marcus.vance.exec@proton.me
  PHONE: +44 20 7946 0841
  TELEGRAM_HANDLE: @vance_capital_direct
  PGP_FINGERPRINT: 4A8F 91C2 3B45 6789 0123 4567 89AB CDEF 1234 5678

WEB_PRESENCE:
  CORPORATE_DOMAIN: vance-holdings.co.uk
  SOCIAL_HANDLE: @mvance_vc
  PERSONAL_DOMAIN: marcusvance.me

FINANCIAL_ASSETS:
  ESCROW_WALLET: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
  PAYMENT_TAG: $vance_holdings

VEHICLE_REGISTRATION:
  LICENSE_PLATE: CA 7XYZ890
  VEHICLE: 2022 Tesla Model 3 Long Range (Slate Grey)
  DMV_STATE: California (US)

PHYSICAL_FOOTPRINT:
  CITY: London, United Kingdom
  REGISTERED_ADDRESS: 42 Curzon Street, Mayfair, London W1J 7TL
  RESIDENCE_ADDRESS: 742 Evergreen Terrace, Palo Alto, CA 94301
  TIMEZONE: UTC+0 (GMT / BST)

INVESTIGATIVE_NOTES:
  Subject serves as sole beneficial owner of 3 offshore holding vehicles. Corroborated with UK registry and Swiss banking correspondent records.
--- END DOSSIER ---`,
  },
  {
    id: 'poi-002',
    title: 'Pseudonymous DeFi Founder De-Anonymization Dossier',
    sourceType: 'forum_leak',
    classificationLevel: 'RESTRICTED',
    sourceUri: 'https://breachforums-mirror.cc/threads/profile-dox-dmitry-kuznetsov.9184',
    description: 'De-anonymized forum profile, Monero escrow ledger, dual encrypted mailboxes, Telegram developer handle, and European residence tracking.',
    rawContent: `--- OPEN-SOURCE PERSONA DE-ANONYMIZATION RECORD ---
INVESTIGATION_SUBJECT: Dmitry Kuznetsov
FULL_NAME: Dmitry Kuznetsov
ALIAS: GhostInTheMesh
MONIKER: mesh_operator_root
ROLE: Lead Smart Contract Architect
ORGANIZATION: Meshbot Labs GmbH

DIGITAL_FOOTPRINT:
  GITHUB_USERNAME: @ghost_mesh_root
  SOCIAL_HANDLE: @ghost_mesh_root
  TELEGRAM: @ghost_mesh_root
  DOMAIN: mesh-botnet-relay.su

CONTACT_CHANNELS:
  PRIMARY_EMAIL: ghost_mesh_ops@proton.me
  SECONDARY_EMAIL: d.kuznetsov91@tutanota.de
  PHONE: +49 89 636 000
  PGP_FINGERPRINT: E94F 82A1 3C78 9012 B345 6789 0123 4567 89AB CDEF

FINANCIAL_LEDGER:
  XMR_WALLET: 44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otRmvJMbx3HigRjDYAZquGLQDuRrKaFK9wwK2VRqFYj2L4vR8pnkW
  ETH_WALLET: 0x71c6bfb7b41e21b21ec4dbb8a6a9efc9b20b2210

VEHICLE_LOG:
  LICENSE_PLATE: B-AB-1234
  VEHICLE: 2021 Audi RS6 Avant (Matte Black)

GEOLOCATION_TELEMETRY:
  COORDINATES: 55.7558, 37.6173
  RESIDENCE: Moscow, Russian Federation
  SECONDARY_CITY: Berlin, Germany

OPERATOR_ANALYSIS:
  Known pseudonym GhostInTheMesh successfully resolved to real-world identity Dmitry Kuznetsov through cross-correlated PGP keys and git commit sign-offs.
--- END RECORD ---`,
  },
  {
    id: 'poi-003',
    title: 'Field Logistics Coordinator EXIF Imagery & Sensor Manifest',
    sourceType: 'media_exif',
    classificationLevel: 'CONFIDENTIAL',
    sourceUri: 'nfs://surveillance-depot-node4/recons/2026-10-OPERATIONAL-FRAME-842.jpg',
    description: 'Embedded camera EXIF metadata, GPS latitude/longitude, field coordinator name, direct phone line, and optical sensor telemetry.',
    rawContent: `EXIF_HEADER_V2.4:
  Camera Make: FLIR Systems Inc
  Camera Model: Star SAFIRE 380-HD
  Lens: Opto-Zoom 450mm Telephoto F/2.8
  Software: FLIR Mission OS v4.12.8
  DateTimeOriginal: 2026:10:11 14:28:42
  Latitude: 33.3152
  Longitude: 44.3661
  Altitude: 1840.5m
  Tactical Grid: MGRS 38SMB45209341

OPTICAL_CHARACTER_RECOGNITION_TRANSCRIPT:
  [OCR CONFIDENCE: 98.4%]
  Container Marking: LOG-CARGO-CONTAINER #TX-90412
  LICENSE_PLATE: TX 904-KL2
  VEHICLE: Freightliner Heavy Logistics Unit
  TARGET_NAME: Sarah Jenkins
  FULL_NAME: Sarah Jenkins
  ROLE: Regional Logistics Director
  ORGANIZATION: Al-Mansoor Freight Logistics
  CONTACT_PHONE: +964-1-719-4821
  EMAIL: dispatch@almansoor-freight.com
  PERSONAL_EMAIL: sarah.jenkins.ops@gmail.com
  POINT_OF_ORIGIN_GPS: 33.3152, 44.3661
  RADIO_CALL_SIGN: @falcon_operator_two
  TELEGRAM_HANDLE: @sarah_falcon_ops
  LOCATION: Baghdad, Iraq`,
  },
  {
    id: 'poi-004',
    title: 'Compromised Microservices Git Repository (.env & Author Log)',
    sourceType: 'git_repo',
    classificationLevel: 'CONFIDENTIAL',
    sourceUri: 'git+ssh://github.com/cloud-infra-core/payment-gateway-service.git#refs/heads/main:commit/7a89f3c',
    description: 'Exposed git commit metadata containing developer real name, corporate email address, internal database ingress, and GitHub handle.',
    rawContent: `commit 7a89f3c912e8471b0dfa21238910481230194821
Author: Alexei Voronov <a.voronov@cloud-infra-core.io>
Date:   Mon Oct 12 04:12:00 2026 -0400
Commit: Merge staging configs for deployment cluster

AUTHOR_NAME: Alexei Voronov
FULL_NAME: Alexei Voronov
ROLE: Lead Infrastructure Engineer
ORGANIZATION: Cloud Infra Core
SECONDARY_ORGANIZATION: Fintech Vault
EMAIL: a.voronov@cloud-infra-core.io
PERSONAL_EMAIL: security-lead@fintech-vault.org
PHONE: +1 (514) 890-4421
GITHUB_USERNAME: @alexei_dev_ops
SOCIAL_HANDLE: @alexei_dev_ops
TELEGRAM: @alexei_dev_core
DOMAIN: cloud-infra-core.io
SECONDARY_DOMAIN: fintech-vault.org
LOCATION: Montreal, Canada
RESIDENCE: Montreal, QC, Canada
BTC_WALLET: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`,
  },
  {
    id: 'poi-005',
    title: 'Academic Researcher & Bioethics Fellow Institution Profile',
    sourceType: 'public_profile',
    classificationLevel: 'UNCLASSIFIED',
    sourceUri: 'https://neuralsync-institute.ch/faculty/dr-elena-rostova',
    description: 'Public faculty bio, verified institutional contact details, ORCID publication history, Zurich laboratory location, and Ethereum research grant address.',
    rawContent: `FACULTY_DIRECTORY_RECORD:
TARGET_NAME: Dr. Elena Rostova
FULL_NAME: Dr. Elena Rostova
ROLE: Principal Research Director
ORGANIZATION: NeuralSync Institute
SECONDARY_AFFILIATION: Swiss Federal AI Bioethics Council
RESIDENCE: Zurich, Switzerland
OFFICE_LOCATION: Campus Irchel, Winterthurerstrasse 190, 8057 Zurich

ACADEMIC_PROVENANCE:
  PRIMARY_EMAIL: e.rostova@neuralsync-institute.ch
  PUBLIC_EMAIL: dr.elena.rostova@proton.me
  PHONE: +41 22 767 8421
  SOCIAL_HANDLE: @dr_rostova_ai
  TELEGRAM_HANDLE: @elena_neuralsync
  DOMAIN: neuralsync-institute.ch
  ORCID_ID: 0000-0002-1825-0097

GRANT_ENDOWMENT_LEDGER:
  ETH_WALLET: 0x71c6bfb7b41e21b21ec4dbb8a6a9efc9b20b2210
  PAYMENT_TAG: $neuralsync_grants

GEOSPATIAL_LABORATORY_GPS:
  COORDINATES: 47.3769, 8.5417
  LOCATION: Zurich, Switzerland`,
  },
];

export function createInitialArtifacts(): IngestedArtifact[] {
  return PRELOADED_DATASETS.map((d, index) => {
    const exif = parseExifMetadata(d.rawContent);
    const hash = computePseudoSha256(d.rawContent);
    const now = new Date(Date.now() - (PRELOADED_DATASETS.length - index) * 600000).toISOString();

    return {
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      sourceUri: d.sourceUri,
      classificationLevel: d.classificationLevel,
      rawContent: d.rawContent,
      contentByteLength: new TextEncoder().encode(d.rawContent).length,
      sha256Hash: hash,
      ingestedAt: now,
      collectorNode: `Node-Alpha (Worker 0${(index % 3) + 1})`,
      status: 'COMPLETED',
      processingTimeMs: 140 + index * 35,
      entitiesExtracted: 0,
      exifParsed: exif.hasExif ? exif : undefined,
      provenanceTrail: [
        {
          stage: 'Intake & Cryptographic SHA-256 Seal',
          node: `Collector-Ingest-${(index % 2) + 1}`,
          timestamp: now,
          durationMs: 24,
          status: 'ok',
          details: `Computed SHA-256 integrity digest (${hash.substring(0, 16)}...)`,
        },
        {
          stage: 'Multimodal Preprocessing & OCR/EXIF Parsing',
          node: 'Node-Alpha (OCR & EXIF)',
          timestamp: new Date(new Date(now).getTime() + 40).toISOString(),
          durationMs: 48,
          status: 'ok',
          details: exif.hasExif
            ? `Extracted EXIF metadata: Camera ${exif.cameraModel || 'Optical Sensor'}, GPS coordinates logged`
            : 'Normalized text stream, charset UTF-8 validated',
        },
        {
          stage: 'Identity NER & Contact Disambiguation',
          node: 'Node-Bravo (Identity Engine)',
          timestamp: new Date(new Date(now).getTime() + 95).toISOString(),
          durationMs: 65,
          status: 'ok',
          details: 'Extracted Names, Aliases, Emails, Phones, Social Handles, and Organizations',
        },
        {
          stage: 'Persona Graph Synthesis & Custody Seal',
          node: 'Node-Delta (Graph Indexer)',
          timestamp: new Date(new Date(now).getTime() + 150).toISOString(),
          durationMs: 32,
          status: 'ok',
          details: 'Relational persona linkages synthesized and indexed into graph datastore',
        },
      ],
    };
  });
}
