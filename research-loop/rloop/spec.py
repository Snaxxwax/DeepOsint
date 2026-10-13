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
