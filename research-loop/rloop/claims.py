import re
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from .verify import verify_claim, Verdict
from .spec import SubQuestionSlot

@dataclass
class ExtractedClaim:
    slot_id: str
    url: str
    value: str
    sentence: str
    verified: bool
    reason: Optional[str]
    extracted_by: str = "deterministic"

def split_sentences(text: str) -> List[str]:
    # Split text by periods, newlines, semicolons followed by space or end
    raw = re.split(r"(?<=[.!?\n])\s+", text or "")
    return [s.strip() for s in raw if len(s.strip()) > 5]

def extract_claims_deterministic(page_text: str, url: str, slot: SubQuestionSlot, vocab_level: int = 0) -> List[ExtractedClaim]:
    claims: List[ExtractedClaim] = []
    sentences = split_sentences(page_text)

    # Active terms based on vocab_level
    # vocab_level 0: answer_terms
    # vocab_level 1+: answer_terms + alt_terms
    terms = list(slot.answer_terms)
    if vocab_level > 0 and slot.alt_terms:
        terms.extend(slot.alt_terms)

    for sentence in sentences:
        sent_lower = sentence.lower()

        # Check if sentence is relevant to this slot
        matched_term = None
        for term in terms:
            if re.search(rf"\b{re.escape(term.lower())}\b", sent_lower):
                matched_term = term
                break

        if not matched_term:
            continue

        # Extract candidate value
        # 1. If value_patterns provided in slot
        found_val = None
        for pat in slot.value_patterns:
            m = re.search(pat, sentence, re.IGNORECASE)
            if m:
                found_val = m.group(1) if m.groups() else m.group(0)
                break

        # 2. Heuristic extraction based on common patterns
        if not found_val:
            # Check for names (e.g., "Kevin Warsh is chair", "Chair Kevin Warsh")
            name_m = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b", sentence)
            if name_m and any(w.lower() in matched_term.lower() for w in ["chair", "president", "director", "head"]):
                found_val = name_m.group(1)
            elif matched_term.lower() in ["governor", "member", "vice chair"]:
                # If term is role e.g. "governor" or "member"
                found_val = "governor" if matched_term.lower() in ["governor", "member"] else matched_term
            else:
                found_val = matched_term

        if found_val:
            verdict = verify_claim(sentence, found_val, page_text)
            claims.append(
                ExtractedClaim(
                    slot_id=slot.slot_id,
                    url=url,
                    value=found_val.strip(),
                    sentence=sentence.strip(),
                    verified=verdict.passed,
                    reason=verdict.reason,
                    extracted_by="deterministic",
                )
            )

    return claims
