from typing import List, Set, Tuple, Dict
from .util import tokenize, normalize_url

SYNDICATION_THRESHOLD = 0.5  # 50% or more word shingle overlap merges into one origin

def get_word_shingles(text: str, k: int = 4) -> Set[Tuple[str, ...]]:
    tokens = tokenize(text)
    if len(tokens) < k:
        return {tuple(tokens)} if tokens else set()
    return {tuple(tokens[i : i + k]) for i in range(len(tokens) - k + 1)}

def jaccard_similarity(set_a: Set[Tuple[str, ...]], set_b: Set[Tuple[str, ...]]) -> float:
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0

def assign_origins(pages: List[Dict[str, str]], threshold: float = SYNDICATION_THRESHOLD) -> Dict[str, str]:
    """
    Given a list of dicts with 'url' and 'text', cluster them into independent origins.
    Returns mapping: url -> origin_id.
    """
    url_to_origin: Dict[str, str] = {}
    origins: List[Dict[str, any]] = []  # List of {'origin_id': str, 'shingles': set, 'urls': list}

    for page in pages:
        norm_url = normalize_url(page["url"])
        shingles = get_word_shingles(page.get("text", ""))

        matched_origin_id = None
        for orig in origins:
            sim = jaccard_similarity(shingles, orig["shingles"])
            if sim >= threshold:
                matched_origin_id = orig["origin_id"]
                break

        if matched_origin_id:
            url_to_origin[page["url"]] = matched_origin_id
        else:
            new_origin_id = f"origin_{len(origins) + 1}"
            origins.append({
                "origin_id": new_origin_id,
                "shingles": shingles,
                "urls": [page["url"]],
            })
            url_to_origin[page["url"]] = new_origin_id

    return url_to_origin
