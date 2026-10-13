import { ExtractedEntity, RelationalEdge, SourceType } from '../types/osint';

// Simple deterministic hash function for browser/node consistency
export function computePseudoSha256(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x67452301, h4 = 0xefcdab89;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
    h4 = Math.imul(h4 ^ ch, 3266489917);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const p1 = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
  const p2 = toHex(h2 ^ h3) + toHex(h1 ^ h4) + toHex(h3 ^ 0x5a827999) + toHex(h4 ^ 0x6ed9eba1);
  return (p1 + p2).toLowerCase();
}

// Extract EXIF data from synthetic or text-embedded EXIF headers
export function parseExifMetadata(text: string): {
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
} {
  const result: ReturnType<typeof parseExifMetadata> = { hasExif: false };

  // Look for GPS coordinates in EXIF format: GPS: 33.3152 N, 44.3661 E or Latitude: 34.0522, Longitude: -118.2437
  const gpsRegex = /(?:GPS\s*(?:Position|Coordinates)?[:=]\s*|Latitude[:=]\s*|\bLat[:=]\s*)([+-]?\d{1,2}\.\d+)[,\s]+(?:(?:Longitude[:=]\s*|\bLon[:=]\s*)|[NS,\s]+)([+-]?\d{1,3}\.\d+)/i;
  const gpsMatch = text.match(gpsRegex);
  if (gpsMatch) {
    result.hasExif = true;
    result.latitude = parseFloat(gpsMatch[1]);
    result.longitude = parseFloat(gpsMatch[2]);
  }

  // Look for Camera Make / Model
  const cameraMatch = text.match(/(?:Camera|Model|Device|Equipment)[:=]\s*([A-Za-z0-9\-\s]{3,30})/i);
  if (cameraMatch) {
    result.hasExif = true;
    result.cameraModel = cameraMatch[1].trim();
  }

  // Look for Altitude
  const altMatch = text.match(/(?:Altitude|Elev)[:=]\s*([+-]?\d+(?:\.\d+)?)\s*(?:m|meters)?/i);
  if (altMatch) {
    result.hasExif = true;
    result.altitudeMeters = parseFloat(altMatch[1]);
  }

  // Look for Software tag
  const softwareMatch = text.match(/(?:Software|Firmware|Editor)[:=]\s*([A-Za-z0-9\.\_\-\s]{3,30})/i);
  if (softwareMatch) {
    result.hasExif = true;
    result.software = softwareMatch[1].trim();
  }

  // Look for Date/Time Original
  const dateMatch = text.match(/(?:DateTimeOriginal|Date\/Time|Captured)[:=]\s*(\d{4}[:\-\/]\d{2}[:\-\/]\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)/i);
  if (dateMatch) {
    result.hasExif = true;
    result.dateTimeOriginal = dateMatch[1].trim();
  }

  return result;
}

// Specialized People OSINT Deterministic Extraction Engine
export function extractEntitiesDeterministic(
  rawText: string,
  artifactId: string,
  sourceHash: string,
  workerNode: string = 'Node-Bravo (Identity Engine)'
): { entities: ExtractedEntity[]; edges: RelationalEdge[] } {
  const entities: ExtractedEntity[] = [];
  const addedValues = new Set<string>();

  const addEntity = (
    category: ExtractedEntity['category'],
    subType: string,
    value: string,
    confidence: number,
    threatScore: number,
    offset: number,
    metadata?: ExtractedEntity['metadata']
  ) => {
    const cleanVal = value.trim();
    if (!cleanVal || cleanVal.length < 2) return;
    const norm = cleanVal.toLowerCase();
    const key = `${category}:${subType}:${norm}`;
    if (addedValues.has(key)) return;
    addedValues.add(key);

    const snippetStart = Math.max(0, offset - 35);
    const snippetEnd = Math.min(rawText.length, offset + cleanVal.length + 35);
    const rawSnippet = '...' + rawText.substring(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim() + '...';

    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
    entities.push({
      id: `ent-${artifactId}-${entities.length + 1}-${uniqueSuffix}`,
      artifactId,
      category,
      subType,
      value: cleanVal,
      normalizedValue: norm,
      confidence,
      threatScore, // exposure / risk / anomaly indicator
      extractionEngine: 'regex_deterministic',
      provenance: {
        sourceHash,
        sourceOffset: offset,
        rawSnippet,
        extractedAt: new Date().toISOString(),
        workerNode,
      },
      metadata,
    });
  };

  let match: RegExpExecArray | null;

  // 1. Full Names (Labeled in investigative dumps)
  const namePatterns = [
    /(?:REAL_NAME|FULL_NAME|SUBJECT_NAME|NAME|PERSON|AUTHOR|DIRECTOR|FOUNDER|INVESTIGATED_PERSON|TARGET_NAME|OFFICER|PARTNER)[:=]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi,
    /(?:Author|Signed By|Contact Person|Lead Developer|Researcher|Executive|Speaker):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
    /\b(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g,
  ];

  for (const regex of namePatterns) {
    while ((match = regex.exec(rawText)) !== null) {
      const name = match[1].trim();
      if (!['FLIR Systems', 'Darknet Scrape', 'Command Node', 'Threat Actor', 'Target Enclave', 'Optical Character'].includes(name)) {
        addEntity('identity', 'full_name', name, 95, 20, match.index, {
          roleOrTitle: 'Subject / Person of Interest',
          verifiedStatus: true,
        });
      }
    }
  }

  // 2. Aliases, Monikers, Usernames & Handles
  const aliasRegex = /(?:ALIAS|MONIKER|CODENAME|SCREEN_NAME|USERNAME|KNOWN_AS|AKA)[:=]\s*([A-Za-z0-9_\-\.]{3,32})/gi;
  while ((match = aliasRegex.exec(rawText)) !== null) {
    addEntity('identity', 'alias', match[1].trim(), 94, 65, match.index, {
      roleOrTitle: 'Known Pseudonym / Moniker',
    });
  }

  // 3. Email Addresses (Contact Vector)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
  while ((match = emailRegex.exec(rawText)) !== null) {
    const email = match[0];
    const domain = match[1].toLowerCase();
    const isPrivacyMail = domain.includes('proton') || domain.includes('tutanota') || domain.includes('anon') || domain.includes('onion') || domain.includes('guerrilla');
    addEntity('contact', 'email', email, 98, isPrivacyMail ? 75 : 25, match.index, {
      lookupUrl: `mailto:${email}`,
      platform: isPrivacyMail ? 'Encrypted / Anonymous Webmail' : 'Standard Webmail / Corporate Mail',
    });
  }

  // 4. Telephone Numbers (E.164 & Formatted)
  const phoneRegex = /(?:PHONE|TEL|CONTACT_PHONE|MOBILE|HOTLINE|CELL)[:=]?\s*(\+?[1-9]\d{0,3}[-.\s]?(?:\(?\d{1,4}\)?[-.\s]?)?\d{1,4}[-.\s]?\d{1,9})\b/gi;
  while ((match = phoneRegex.exec(rawText)) !== null) {
    const rawNum = match[1].trim();
    if (rawNum.replace(/\D/g, '').length >= 7) {
      addEntity('contact', 'phone', rawNum, 92, 35, match.index, {
        lookupUrl: `tel:${rawNum}`,
        platform: 'Telephony Carrier Vector',
      });
    }
  }

  // 5. Messaging & Direct Communication Vectors
  // Telegram
  const tgRegex = /(?:TELEGRAM(?:_HANDLE|_CHANNEL)?|t\.me\/)[:=]?\s*@?([A-Za-z0-9_]{4,32})/gi;
  while ((match = tgRegex.exec(rawText)) !== null) {
    const handle = match[1];
    addEntity('contact', 'telegram_handle', `@${handle}`, 96, 60, match.index, {
      lookupUrl: `https://t.me/${handle}`,
      platform: 'Telegram Messenger',
    });
  }

  // Discord / Signal / Matrix
  const discordRegex = /(?:DISCORD|SIGNAL|MATRIX)[:=]?\s*(@?[A-Za-z0-9_\.]{3,32}(?:#\d{4}|:[a-z0-9\.\-]+)?)/gi;
  while ((match = discordRegex.exec(rawText)) !== null) {
    addEntity('contact', 'messaging_id', match[1], 90, 45, match.index, {
      platform: 'Encrypted Direct Messaging',
    });
  }

  // PGP Key Fingerprint
  const pgpRegex = /\b(?:[A-F0-9]{4}\s*){10}\b/gi;
  while ((match = pgpRegex.exec(rawText)) !== null) {
    const cleaned = match[0].replace(/\s+/g, '').toUpperCase();
    if (cleaned.length === 40) {
      addEntity('contact', 'pgp_fingerprint', cleaned, 99, 40, match.index, {
        platform: 'OpenPGP Web-of-Trust',
      });
    }
  }

  // 6. Social Footprint & Code Repositories
  // Social media handles (@handle, github.com, x.com, linkedin.com)
  const socialRegex = /(?:@|(?:twitter\.com|x\.com|github\.com|reddit\.com\/u|linkedin\.com\/in)\/)([a-zA-Z0-9_\.]{3,30})/gi;
  while ((match = socialRegex.exec(rawText)) !== null) {
    const handle = match[1];
    const lower = handle.toLowerCase();
    // Exclude code tokens and markdown false positives
    if (!['param', 'return', 'type', 'license', 'override', 'throws', 'import', 'export', 'main', 'refs'].includes(lower)) {
      addEntity('social_footprint', 'social_handle', `@${handle}`, 91, 30, match.index, {
        lookupUrl: `https://github.com/${handle}`,
        platform: 'Cross-Platform Social Footprint',
      });
    }
  }

  // Personal Domains / Websites
  const domainRegex = /\b(?:[a-zA-Z0-9-]{2,}\.)+(?:com|org|net|io|me|ai|cc|su|de|co\.uk|info)\b/gi;
  while ((match = domainRegex.exec(rawText)) !== null) {
    const dom = match[0].toLowerCase();
    if (!dom.includes('github') && !dom.includes('proton') && !dom.includes('t.me') && !dom.includes('google')) {
      addEntity('social_footprint', 'domain', dom, 88, 30, match.index, {
        lookupUrl: `https://${dom}`,
        platform: 'Web Identity & DNS Asset',
      });
    }
  }

  // 7. Organizations, Employers, Foundations & Universities (Affiliations)
  const orgPatterns = [
    /(?:EMPLOYER|COMPANY|ORGANIZATION|AFFILIATION|CONSIGNEE|INSTITUTION|DIRECTORSHIP|FIRM)[:=]\s*([A-Za-z0-9\s&,\.\-]{3,45})/gi,
    /\b([A-Z][A-Za-z0-9\s&]{2,30}\s+(?:Technologies|Logistics|Capital|Holdings|Solutions|Foundation|Laboratories|LLC|Inc\.|Corp\.|GmbH|Ltd\.))\b/g,
  ];

  for (const regex of orgPatterns) {
    while ((match = regex.exec(rawText)) !== null) {
      const orgName = match[1].trim().replace(/[\r\n]+/g, ' ');
      if (!['FLIR Systems Inc', 'Darknet Scrape', 'MITRE Tactic'].includes(orgName)) {
        addEntity('affiliation', 'organization', orgName, 92, 20, match.index, {
          roleOrTitle: 'Affiliated Corporate / Entity Body',
        });
      }
    }
  }

  // Job Titles & Executive Roles
  const titleRegex = /(?:ROLE|TITLE|POSITION|JOB_TITLE)[:=]\s*([A-Za-z0-9\s\/\-]{4,35})/gi;
  while ((match = titleRegex.exec(rawText)) !== null) {
    addEntity('affiliation', 'job_title', match[1].trim(), 89, 15, match.index, {
      roleOrTitle: 'Professional Title',
    });
  }

  // 8. Vehicle License Plates & Registrations
  const platePatterns = [
    /(?:LICENSE_PLATE|PLATE|VEHICLE_TAG|REGISTRATION_PLATE|TAG|CAR_PLATE|VEHICLE_REG|DMV_TAG)[:=]\s*([A-Z0-9\-\s]{5,10})/gi,
    /\b(?:Plate|Tag):\s*([A-Z0-9]{2,4}[-\s]?[A-Z0-9]{3,5})\b/gi,
    /\b(?:CA|NY|TX|FL|WA|IL|MA|OH|VA|NJ|GA|NC|MI|PA|AZ)\s+(?:Plate\s+)?([A-Z0-9]{2,4}[-\s]?[A-Z0-9]{3,5})\b/gi,
  ];
  for (const regex of platePatterns) {
    while ((match = regex.exec(rawText)) !== null) {
      const plate = match[1].trim().toUpperCase().replace(/\s+/g, ' ');
      if (plate.length >= 4 && !['SYSTEM', 'NODE-01', 'STATUS', 'SERVER'].includes(plate)) {
        addEntity('vehicle', 'license_plate', plate, 94, 40, match.index, {
          platform: 'Department of Motor Vehicles / Vehicle Registry',
          roleOrTitle: 'Registered Vehicle License Plate',
        });
      }
    }
  }

  // 9. Physical Street Addresses
  const addressPatterns = [
    /(?:STREET_ADDRESS|PHYSICAL_ADDRESS|RESIDENCE_ADDRESS|OFFICE_ADDRESS|ADDRESS)[:=]\s*([0-9A-Za-z\s,\.\-#]{8,60})/gi,
    /\b(\d{1,5}\s+[A-Za-z0-9\.\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Way|Lane|Ln|Court|Ct)[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s+\d{5})\b/gi,
  ];
  for (const regex of addressPatterns) {
    while ((match = regex.exec(rawText)) !== null) {
      const addr = match[1].trim().replace(/\s+/g, ' ');
      addEntity('geo', 'physical_address', addr, 91, 35, match.index, {
        locationName: addr,
        roleOrTitle: 'Physical Street Address',
      });
    }
  }

  // 10. Financial & Crypto Wallets Tied to Personas
  // Bitcoin
  const btcRegex = /\b(?:1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{38,59})\b/g;
  while ((match = btcRegex.exec(rawText)) !== null) {
    addEntity('financial', 'crypto_btc', match[0], 97, 70, match.index, {
      platform: 'Bitcoin Blockchain Ledger',
    });
  }

  // Ethereum
  const ethRegex = /\b0x[a-fA-F0-9]{40}\b/g;
  while ((match = ethRegex.exec(rawText)) !== null) {
    addEntity('financial', 'crypto_eth', match[0], 97, 65, match.index, {
      platform: 'Ethereum / EVM Contract Asset',
    });
  }

  // Monero
  const xmrRegex = /\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g;
  while ((match = xmrRegex.exec(rawText)) !== null) {
    addEntity('financial', 'crypto_xmr', match[0], 99, 85, match.index, {
      platform: 'Monero Untraceable Privacy Ledger',
    });
  }

  // 11. Geospatial & Physical Provenance
  // Lat/Long from text
  const geoRegex = /([+-]?\d{1,2}\.\d{4,8})[,\s]+([+-]?\d{1,3}\.\d{4,8})/g;
  while ((match = geoRegex.exec(rawText)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (Math.abs(lat) > 0.001 || Math.abs(lon) > 0.001)) {
      addEntity(
        'geo',
        'exif_coordinates',
        `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        96,
        30,
        match.index,
        {
          latitude: lat,
          longitude: lon,
          locationName: 'Sensor / Physical Capture Coordinates',
        }
      );
    }
  }

  // Named Cities & Resumed Locations
  const cityRegex = /(?:LOCATION|RESIDENCE|CITY|BASED_IN|HOMETOWN|LIVES_IN)[:=]\s*([A-Za-z\s,\.\-]{3,35})/gi;
  while ((match = cityRegex.exec(rawText)) !== null) {
    const locName = match[1].trim();
    addEntity('geo', 'residence_city', locName, 88, 20, match.index, {
      locationName: locName,
    });
  }

  // 12. Relational Graph Linker (Persona-Centric OSINT)
  const edges: RelationalEdge[] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const e1 = entities[i];
      const e2 = entities[j];

      let rel: RelationalEdge['relationship'] | null = null;
      let evidence = '';

      // Person <-> Alias
      if (e1.subType === 'full_name' && e2.subType === 'alias') {
        rel = 'KNOWN_ALIAS_OF';
        evidence = `Persona '${e1.value}' corroborated under pseudonym/moniker '${e2.value}'`;
      } else if (e2.subType === 'full_name' && e1.subType === 'alias') {
        rel = 'KNOWN_ALIAS_OF';
        evidence = `Moniker '${e1.value}' resolved to identified person '${e2.value}'`;
      }
      // Person <-> Contact Vector (Email, Phone, Telegram)
      else if (e1.category === 'identity' && e2.category === 'contact') {
        rel = 'CONTACT_VECTOR_OF';
        evidence = `Direct communication channel '${e2.value}' associated with subject '${e1.value}'`;
      } else if (e2.category === 'identity' && e1.category === 'contact') {
        rel = 'CONTACT_VECTOR_OF';
        evidence = `Subject '${e2.value}' reached via contact vector '${e1.value}'`;
      }
      // Person <-> Social Footprint
      else if (e1.category === 'identity' && e2.category === 'social_footprint') {
        rel = 'AUTHORED_PROFILE';
        evidence = `Online profile handle '${e2.value}' authored or registered by '${e1.value}'`;
      }
      // Person <-> Organization
      else if (e1.category === 'identity' && e2.subType === 'organization') {
        rel = 'EMPLOYED_BY';
        evidence = `Subject '${e1.value}' holds affiliation or employment with '${e2.value}'`;
      } else if (e2.category === 'identity' && e1.subType === 'organization') {
        rel = 'EMPLOYED_BY';
        evidence = `Corporate entity '${e1.value}' employs subject '${e2.value}'`;
      }
      // Person <-> Financial
      else if (e1.category === 'identity' && e2.category === 'financial') {
        rel = 'FINANCIALLY_LINKED';
        evidence = `Cryptographic ledger or settlement address '${e2.value}' routed to subject '${e1.value}'`;
      }
      // Person <-> Geolocation
      else if (e1.category === 'identity' && e2.category === 'geo') {
        rel = 'GEOLOCATED_AT';
        evidence = `Physical presence or operational location verified at '${e2.value}'`;
      }
      // Person <-> Vehicle / License Plate
      else if (e1.category === 'identity' && e2.subType === 'license_plate') {
        rel = 'DRIVES_VEHICLE';
        evidence = `Subject '${e1.value}' registered to or observed driving vehicle with license plate '${e2.value}'`;
      } else if (e2.category === 'identity' && e1.subType === 'license_plate') {
        rel = 'DRIVES_VEHICLE';
        evidence = `Vehicle with plate '${e1.value}' registered to identified subject '${e2.value}'`;
      }
      // Person <-> Physical Address
      else if (e1.category === 'identity' && e2.subType === 'physical_address') {
        rel = 'RESIDES_AT';
        evidence = `Subject '${e1.value}' associated with physical property/residence '${e2.value}'`;
      } else if (e2.category === 'identity' && e1.subType === 'physical_address') {
        rel = 'RESIDES_AT';
        evidence = `Physical address '${e1.value}' linked to resident '${e2.value}'`;
      }
      // Handle <-> Domain
      else if (e1.subType === 'social_handle' && e2.subType === 'domain') {
        rel = 'REGISTERED_DOMAIN';
        evidence = `Asset domain '${e2.value}' linked to handle '${e1.value}'`;
      }
      // Person <-> Person (Co-occurrence / Associates)
      else if (e1.subType === 'full_name' && e2.subType === 'full_name') {
        rel = 'ASSOCIATED_WITH';
        evidence = `Subjects '${e1.value}' and '${e2.value}' co-occur within the same operational record`;
      }

      if (rel) {
        const edgeSuffix = Math.random().toString(36).substring(2, 9);
        edges.push({
          id: `edge-${artifactId}-${edges.length + 1}-${edgeSuffix}`,
          sourceEntityId: e1.id,
          targetEntityId: e2.id,
          sourceValue: e1.value,
          targetValue: e2.value,
          relationship: rel,
          confidence: Math.round((e1.confidence + e2.confidence) / 2),
          evidence,
        });
      }
    }
  }

  return { entities, edges };
}
