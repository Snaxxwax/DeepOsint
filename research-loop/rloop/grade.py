from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
from .util import parse_iso_date, days_between

@dataclass
class SlotGrade:
    slot_id: str
    answer_value: str
    grade: str  # A, B, C, D, X
    origins_count: int
    is_source_of_record: bool
    is_fresh: bool
    shelf_life_status: str  # "fresh", "stale", "unknown"
    notes: str

def is_domain_match(url: str, primary_domains: List[str]) -> bool:
    host = urlparse(url).netloc.lower()
    for pd in primary_domains:
        pd_clean = pd.lower()
        if host == pd_clean or host.endswith("." + pd_clean):
            return True
    return False

def grade_slot(
    slot_id: str,
    verified_claims: List[Dict[str, Any]],
    pages_map: Dict[str, Dict[str, Any]],
    primary_domains: List[str],
    as_of_str: str,
    shelf_life_days: int = 90
) -> SlotGrade:
    if not verified_claims:
        return SlotGrade(
            slot_id=slot_id,
            answer_value="None",
            grade="D",
            origins_count=0,
            is_source_of_record=False,
            is_fresh=False,
            shelf_life_status="stale",
            notes="No verified claims found",
        )

    as_of = parse_iso_date(as_of_str)

    # Group claims by answer value
    val_groups: Dict[str, List[Dict[str, Any]]] = {}
    for c in verified_claims:
        norm_val = c["value"].strip()
        val_groups.setdefault(norm_val, []).append(c)

    # Analyze each candidate value
    candidates: List[Dict[str, Any]] = []
    for val, c_list in val_groups.items():
        origin_ids = set()
        has_primary = False
        min_age = None
        has_fresh_origin = False

        for c in c_list:
            p = pages_map.get(c["url"], {})
            orig_id = p.get("origin_id", c["url"])
            origin_ids.add(orig_id)

            if is_domain_match(c["url"], primary_domains):
                has_primary = True

            pub_date_str = p.get("published_date") or p.get("updated_date")
            if pub_date_str:
                try:
                    pub_d = parse_iso_date(pub_date_str)
                    age = days_between(as_of, pub_d)
                    if min_age is None or age < min_age:
                        min_age = age
                    if age <= shelf_life_days:
                        has_fresh_origin = True
                except Exception:
                    pass
            else:
                # If no date, treat as fresh unless proven stale
                has_fresh_origin = True

        candidates.append({
            "value": val,
            "origins_count": len(origin_ids),
            "has_primary": has_primary,
            "min_age": min_age,
            "is_fresh": has_fresh_origin,
        })

    # Sort candidates by: has_primary desc, origins_count desc, is_fresh desc
    candidates.sort(key=lambda x: (1 if x["has_primary"] else 0, x["origins_count"], 1 if x["is_fresh"] else 0), reverse=True)

    # Check for disagreement (X)
    if len(candidates) > 1:
        top = candidates[0]
        second = candidates[1]
        # A fresh source of record overrules disagreement!
        if top["has_primary"] and top["is_fresh"]:
            winning = top
        elif top["origins_count"] >= 2 and second["origins_count"] <= 1:
            winning = top
        else:
            return SlotGrade(
                slot_id=slot_id,
                answer_value=f"{top['value']} vs {second['value']}",
                grade="X",
                origins_count=top["origins_count"],
                is_source_of_record=top["has_primary"],
                is_fresh=top["is_fresh"],
                shelf_life_status="fresh" if top["is_fresh"] else "stale",
                notes=f"Answers disagree ({top['value']} vs {second['value']}) without source of record resolution",
            )
    else:
        winning = candidates[0]

    val = winning["value"]
    origins_cnt = winning["origins_count"]
    has_primary = winning["has_primary"]
    is_fresh = winning["is_fresh"]
    min_age = winning["min_age"]

    # Grade determination:
    # Grade A: Source of record confirms it, or >= 2 independent origins fresh within shelf life
    if (has_primary and is_fresh) or (has_primary and origins_cnt >= 2) or (origins_cnt >= 2 and is_fresh and (has_primary or min_age is not None and min_age <= shelf_life_days)):
        grade = "A"
        notes = "Confirmed by source of record" if has_primary else f"{origins_cnt} independent origins within shelf life"
    elif origins_cnt >= 2 and not is_fresh:
        # Grade C: two origins, but news is past shelf life
        grade = "C"
        notes = f"{origins_cnt} origins, but evidence is {min_age or 'unknown'} days old against a {shelf_life_days}-day shelf life"
    elif origins_cnt == 1 and is_fresh and not has_primary:
        grade = "D"
        notes = f"1 origin, uncorroborated"
    else:
        # Grade D: 1 origin, stale or uncorroborated
        grade = "D"
        notes = f"{origins_cnt} origin, stale" if not is_fresh else f"{origins_cnt} origin"

    return SlotGrade(
        slot_id=slot_id,
        answer_value=val,
        grade=grade,
        origins_count=origins_cnt,
        is_source_of_record=has_primary,
        is_fresh=is_fresh,
        shelf_life_status="fresh" if is_fresh else "stale",
        notes=notes,
    )
