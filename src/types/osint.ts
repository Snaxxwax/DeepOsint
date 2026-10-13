export type SourceType = 
  | 'public_profile' 
  | 'social_media' 
  | 'corporate_registry' 
  | 'resume_cv' 
  | 'forum_leak' 
  | 'media_exif' 
  | 'court_filing' 
  | 'git_repo';

export type EntityCategory = 
  | 'identity' 
  | 'contact' 
  | 'social_footprint' 
  | 'affiliation' 
  | 'financial' 
  | 'geo'
  | 'vehicle'
  | 'ioc';

export type IdentityType = 
  | 'full_name' 
  | 'alias' 
  | 'maiden_name' 
  | 'date_of_birth' 
  | 'nationality' 
  | 'language';

export type ContactType = 
  | 'email' 
  | 'phone' 
  | 'telegram_handle' 
  | 'signal_handle' 
  | 'discord_tag' 
  | 'matrix_id' 
  | 'pgp_fingerprint';

export type VehicleType =
  | 'license_plate'
  | 'vin'
  | 'vehicle_make_model';

export type SocialFootprintType = 
  | 'username'
  | 'twitter_x' 
  | 'linkedin_handle' 
  | 'github_username' 
  | 'reddit_user' 
  | 'forum_username' 
  | 'gravatar_hash' 
  | 'personal_website' 
  | 'domain';

export type AffiliationType = 
  | 'organization' 
  | 'job_title' 
  | 'educational_institution' 
  | 'corporate_directorship' 
  | 'political_party' 
  | 'credential';

export type FinancialType = 
  | 'crypto_btc' 
  | 'crypto_eth' 
  | 'crypto_xmr' 
  | 'payment_handle' 
  | 'escrow_wallet';

export type GeoType = 
  | 'exif_coordinates' 
  | 'residence_city' 
  | 'check_in_location' 
  | 'office_location' 
  | 'physical_address'
  | 'timezone_offset';

export type SeedIdentifierType = 'auto' | 'name' | 'email' | 'phone' | 'license_plate' | 'username';

export interface SeedIdentifier {
  id: string;
  value: string;
  type: SeedIdentifierType;
  inferredType: 'name' | 'email' | 'phone' | 'license_plate' | 'username';
}

export interface DeepWebHit {
  id: string;
  source: string;
  sourceType: 'darkweb_forum' | 'breach_dump' | 'pastebin' | 'code_repo' | 'vehicle_registry' | 'deepweb_onion';
  title: string;
  leakDate: string;
  snippet: string;
  matchedIdentifiers: string[];
  onionMirror?: string;
  sha256: string;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface InvestigationDossier {
  id: string;
  targetQuery: string;
  seedIdentifiers: SeedIdentifier[];
  queriesFormulated: string[];
  totalHits: number;
  hits: DeepWebHit[];
  reasoningSummary: string;
  coOccurrences: {
    identifierA: string;
    identifierB: string;
    correlationStrength: number; // 0-100
    evidence: string;
  }[];
  extractedEntities: ExtractedEntity[];
  extractedEdges: RelationalEdge[];
  timestamp: string;
  auditHash: string;
}

export interface ExtractedEntity {
  id: string;
  artifactId: string;
  category: EntityCategory;
  subType: string;
  value: string;
  normalizedValue: string;
  confidence: number; // 0 to 100
  threatScore?: number; // In People OSINT: Exposure / Risk / Verification Flag (0-100)
  extractionEngine: 'regex_deterministic' | 'llm_semantic_ner' | 'exif_binary_parser';
  provenance: {
    sourceHash: string;
    sourceOffset?: number;
    rawSnippet: string;
    extractedAt: string;
    workerNode: string;
  };
  metadata?: {
    country?: string;
    city?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    altitudeMeters?: number;
    cameraModel?: string;
    timestamp?: string;
    platform?: string;
    lookupUrl?: string;
    roleOrTitle?: string;
    verifiedStatus?: boolean;
    timezone?: string;
  };
}

export interface RelationalEdge {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceValue: string;
  targetValue: string;
  relationship: 
    | 'KNOWN_ALIAS_OF' 
    | 'CONTACT_VECTOR_OF' 
    | 'ASSOCIATED_WITH' 
    | 'EMPLOYED_BY' 
    | 'FOUNDED_ORGANIZATION' 
    | 'REGISTERED_DOMAIN' 
    | 'FINANCIALLY_LINKED' 
    | 'GEOLOCATED_AT' 
    | 'CO_OCCURS_WITH' 
    | 'AUTHORED_PROFILE'
    | 'DRIVES_VEHICLE'
    | 'REGISTERED_PLATE_TO'
    | 'OPERATES_HANDLE'
    | 'USES_PHONE'
    | 'USES_EMAIL'
    | 'RESIDES_AT';
  confidence: number;
  evidence: string;
}

export interface IngestedArtifact {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceUri: string;
  classificationLevel: 'UNCLASSIFIED' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
  rawContent: string;
  contentByteLength: number;
  sha256Hash: string;
  ingestedAt: string;
  collectorNode: string;
  status: 'QUEUED' | 'INGESTING' | 'PREPROCESSING' | 'EXTRACTING' | 'GRAPH_SYNTHESIS' | 'COMPLETED' | 'FAILED';
  processingTimeMs: number;
  entitiesExtracted: number;
  exifParsed?: {
    hasExif: boolean;
    cameraMake?: string;
    cameraModel?: string;
    lens?: string;
    software?: string;
    dateTimeOriginal?: string;
    latitude?: number;
    longitude?: number;
    altitudeMeters?: number;
    locationName?: string;
  };
  provenanceTrail: {
    stage: string;
    node: string;
    timestamp: string;
    durationMs: number;
    status: 'ok' | 'warn' | 'error';
    details: string;
  }[];
}

export interface PipelineWorker {
  id: string;
  name: string;
  role: 'Intake & Hash' | 'OCR & EXIF Preprocessor' | 'Identity NER & Alias Correlator' | 'Graph Synthesizer & Indexer';
  status: 'idle' | 'busy' | 'healthy';
  tasksCompleted: number;
  currentTask?: string;
  loadPercentage: number;
  memoryMb: number;
}

export interface PipelineMetrics {
  totalArtifactsIngested: number;
  totalEntitiesExtracted: number;
  totalRelationsMapped: number;
  averageIngestionLatencyMs: number;
  throughputKbPerSec: number;
  queueDepth: number;
  activeWorkers: number;
  lastRunTimestamp: string;
}
