from dataclasses import dataclass
from typing import Optional
from .util import key_tokens

@dataclass
class Verdict:
    passed: bool
    reason: Optional[str] = None

def verify_claim(sentence: str, value: str, page_text: str) -> Verdict:
    page_norm = " ".join((page_text or "").split()).lower()
    sent_norm = " ".join((sentence or "").split()).lower()

    if not sent_norm or sent_norm not in page_norm:
        return Verdict(False, "supporting sentence not found on page")

    missing = [t for t in key_tokens(value) if t.lower() not in page_norm]
    if missing:
        return Verdict(False, f"value not found on page: {', '.join(missing)}")

    return Verdict(True, None)
