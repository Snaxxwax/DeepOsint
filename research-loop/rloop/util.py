import hashlib
import re
from datetime import date, datetime
from typing import List, Set
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "")
    return text.strip()

def tokenize(text: str) -> List[str]:
    return [t.lower() for t in re.findall(r"\b[A-Za-z0-9_-]+\b", text or "")]

def key_tokens(text: str) -> List[str]:
    """Tokenize and filter common stop words to test find-the-words presence."""
    stopwords = {"a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "it", "its"}
    tokens = tokenize(text)
    return [t for t in tokens if t not in stopwords and len(t) > 1]

def parse_iso_date(date_str: str) -> date:
    clean = (date_str or "").strip()[:10]
    return datetime.strptime(clean, "%Y-%m-%d").date()

def days_between(d1: date, d2: date) -> int:
    return abs((d1 - d2).days)

def normalize_url(url: str) -> str:
    """Collapses tracking parameters, AMP, and locale prefixes."""
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    
    # Drop AMP subdomains
    if netloc.startswith("amp."):
        netloc = netloc[4:]

    # Remove tracking query parameters
    tracking_params = {
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "ref", "source", "amp"
    }
    query_items = [(k, v) for k, v in parse_qsl(parsed.query) if k.lower() not in tracking_params]
    query_str = urlencode(query_items)

    path = parsed.path
    # Strip trailing slash if not root
    if path.endswith("/") and len(path) > 1:
        path = path[:-1]

    # Strip common locale prefixes like /en-us/ or /en/
    path = re.sub(r"^/[a-z]{2}(-[a-z]{2})?/", "/", path)

    return urlunparse((parsed.scheme or "https", netloc, path, "", query_str, ""))
