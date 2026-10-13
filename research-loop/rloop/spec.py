import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional

RELATIVE_WORDS = {
    "latest", "this year", "today", "yesterday", "recent", "recently",
    "current", "currently", "now", "last year", "next year", "upcoming"
}

SHELF_LIFE_DAYS = {
    "fast_moving": 30,
    "leadership": 90,
    "slow_moving": 90,
    "historical": 365,
}

@dataclass
class SubQuestionSlot:
    slot_id: str
    question: str
    answer_terms: List[str]
    alt_terms: List[str] = field(default_factory=list)
    value_patterns: List[str] = field(default_factory=list)
    entity: Optional[str] = None

@dataclass
class ResearchSpec:
    question: str
    as_of: str
    required_grade: str
    fact_class: str
    primary_domains: List[str]
    slots: List[SubQuestionSlot]
    shelf_life_days: int = 90
    max_rounds: int = 5
    results_per_query: int = 8

    def to_dict(self) -> Dict[str, Any]:
        return {
            "question": self.question,
            "as_of": self.as_of,
            "required_grade": self.required_grade,
            "fact_class": self.fact_class,
            "primary_domains": self.primary_domains,
            "shelf_life_days": self.shelf_life_days,
            "max_rounds": self.max_rounds,
            "results_per_query": self.results_per_query,
            "slots": [
                {
                    "slot_id": s.slot_id,
                    "question": s.question,
                    "answer_terms": s.answer_terms,
                    "alt_terms": s.alt_terms,
                    "value_patterns": s.value_patterns,
                    "entity": s.entity,
                }
                for s in self.slots
            ],
        }

def validate_spec_data(data: Dict[str, Any]) -> ResearchSpec:
    if not isinstance(data, dict):
        raise ValueError("Spec must be an object")
    for key in ("question", "as_of", "required_grade", "fact_class"):
        if not isinstance(data.get(key), str) or len(data[key]) > 2000:
            raise ValueError(f"Invalid {key}")
    if data["required_grade"].upper() not in ("A", "B", "C", "D", "X"):
        raise ValueError("Invalid required_grade")
    if not isinstance(data.get("primary_domains"), list) or not 1 <= len(data["primary_domains"]) <= 20:
        raise ValueError("primary_domains must contain 1–20 domains")
    if any(not isinstance(d, str) or not re.fullmatch(r"[a-zA-Z0-9.-]{1,253}", d) for d in data["primary_domains"]):
        raise ValueError("Invalid primary domain")
    if not isinstance(data.get("slots"), list) or not 1 <= len(data["slots"]) <= 10:
        raise ValueError("Provide 1–10 sub-question slots")
    slot_ids = set()
    for index, slot in enumerate(data["slots"]):
        if not isinstance(slot, dict) or not isinstance(slot.get("question"), str) or len(slot["question"]) > 2000:
            raise ValueError("Invalid slot question")
        sid = slot.get("slot_id", f"slot_{index + 1}")
        if not isinstance(sid, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", sid) or sid in slot_ids:
            raise ValueError("Invalid or duplicate slot_id")
        slot_ids.add(sid)
        if slot.get("entity") is not None and (not isinstance(slot["entity"], str) or len(slot["entity"]) > 200):
            raise ValueError("Invalid slot entity")
        for field in ("answer_terms", "alt_terms", "value_patterns"):
            terms = slot.get(field, [])
            if not isinstance(terms, list) or len(terms) > 20 or any(not isinstance(t, str) or not t.strip() or len(t) > 200 for t in terms):
                raise ValueError(f"Invalid {field}")
        for pattern in slot.get("value_patterns", []):
            try:
                re.compile(pattern)
            except re.error:
                raise ValueError("Invalid value_patterns regex")
    for key, default, maximum in (("max_rounds", 5, 5), ("results_per_query", 8, 10), ("shelf_life_days", 90, 3650)):
        value = data.get(key, default)
        if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= maximum:
            raise ValueError(f"{key} must be 1–{maximum}")

    # 1. Five frame slots check
    required_frame = ["question", "as_of", "required_grade", "fact_class", "primary_domains"]
    for field_name in required_frame:
        val = data.get(field_name)
        if val is None or (isinstance(val, (str, list)) and len(val) == 0):
            raise ValueError(f"Spec rejected: missing or empty frame slot '{field_name}'")

    # 2. Check as_of is strict YYYY-MM-DD
    as_of = str(data["as_of"]).strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", as_of):
        raise ValueError(f"Spec rejected: as_of date '{as_of}' must be absolute date YYYY-MM-DD")
    try:
        datetime.strptime(as_of, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Spec rejected: invalid date '{as_of}'")

    # 3. Check for relative time words in query-bound fields
    def check_relative(text: str, ctx: str):
        lower = text.lower()
        for rel in RELATIVE_WORDS:
            pattern = rf"\b{re.escape(rel)}\b"
            if re.search(pattern, lower):
                raise ValueError(f"Spec rejected: field '{ctx}' contains relative time word '{rel}'")

    check_relative(data["question"], "question")

    slots_raw = data.get("slots", [])
    if not slots_raw:
        raise ValueError("Spec rejected: spec must contain at least one sub-question slot")

    slots: List[SubQuestionSlot] = []
    for idx, s in enumerate(slots_raw):
        slot_id = s.get("slot_id") or f"slot_{idx+1}"
        q = s.get("question", "")
        if not q.strip():
            raise ValueError(f"Spec rejected: slot '{slot_id}' question cannot be empty")
        check_relative(q, f"slot.{slot_id}.question")

        answer_terms = s.get("answer_terms", [])
        if not answer_terms:
            raise ValueError(f"Spec rejected: slot '{slot_id}' requires answer_terms")
        for term in answer_terms:
            check_relative(term, f"slot.{slot_id}.answer_terms")

        alt_terms = s.get("alt_terms", [])
        for term in alt_terms:
            check_relative(term, f"slot.{slot_id}.alt_terms")

        slots.append(
            SubQuestionSlot(
                slot_id=slot_id,
                question=q,
                answer_terms=answer_terms,
                alt_terms=alt_terms,
                value_patterns=s.get("value_patterns", []),
                entity=s.get("entity"),
            )
        )

    fact_class = str(data["fact_class"]).lower()
    shelf_life = data.get("shelf_life_days") or SHELF_LIFE_DAYS.get(fact_class, 90)

    return ResearchSpec(
        question=data["question"],
        as_of=as_of,
        required_grade=str(data["required_grade"]).upper(),
        fact_class=data["fact_class"],
        primary_domains=[str(d).lower().strip() for d in data["primary_domains"]],
        slots=slots,
        shelf_life_days=shelf_life,
        max_rounds=int(data.get("max_rounds", 5)),
        results_per_query=int(data.get("results_per_query", 8)),
    )

def load_spec(filepath: str) -> ResearchSpec:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return validate_spec_data(data)
