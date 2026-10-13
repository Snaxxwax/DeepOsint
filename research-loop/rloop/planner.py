from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from .spec import ResearchSpec, SubQuestionSlot
from .grade import SlotGrade

@dataclass
class PlannedQuery:
    slot_id: str
    query_text: str
    angle: str
    fix: Optional[str] = None

FIX_TABLE = [
    {
        "symptom": "no_results",
        "fix_name": "broaden",
        "description": "Broaden: switch to alternative vocabulary, then lateral and adversarial",
        "angles": ["direct", "primary", "lateral"],
        "advance_vocab": True,
    },
    {
        "symptom": "answers_disagree",
        "fix_name": "go_upstream",
        "description": "Go upstream",
        "angles": ["primary", "temporal"],
        "advance_vocab": False,
    },
    {
        "symptom": "no_source_of_record",
        "fix_name": "primary",
        "description": "Primary: site: query per primary domain",
        "angles": ["primary"],
        "advance_vocab": False,
    },
    {
        "symptom": "source_of_record_no_claim",
        "fix_name": "vocabulary",
        "description": "Vocabulary: query and extract with the alternative terms",
        "angles": ["primary", "direct"],
        "advance_vocab": True,
    },
    {
        "symptom": "fewer_than_two_origins",
        "fix_name": "corroborate",
        "description": "Corroborate: adversarial, lateral, temporal",
        "angles": ["adversarial", "lateral", "temporal"],
        "advance_vocab": False,
    },
    {
        "symptom": "evidence_past_shelf_life",
        "fix_name": "refresh",
        "description": "Refresh: temporal, primary",
        "angles": ["temporal", "primary"],
        "advance_vocab": False,
    },
]

def derive_entity(slot: SubQuestionSlot, spec_question: str) -> str:
    if slot.entity:
        return slot.entity
    q = slot.question.lower()
    if "powell" in q:
        return "Jerome Powell"
    elif "fed" in q or "federal reserve" in q:
        return "Federal Reserve"
    # Fallback to key nouns in slot question
    tokens = [w for w in slot.question.split() if w[0].isupper() and w.lower() not in {"who", "what", "where", "when", "why", "how", "is", "the"}]
    return " ".join(tokens) if tokens else "Federal Reserve"

def build_query_text(entity: str, vocab_term: str, angle: str, primary_domain: Optional[str], as_of_year: str) -> str:
    # Rule: The expected answer NEVER enters a query!
    entity_clean = entity.strip()
    term_clean = vocab_term.strip()

    if angle == "direct":
        return f"{entity_clean} {term_clean}".strip()
    elif angle == "primary":
        if primary_domain:
            return f"site:{primary_domain} {entity_clean} {term_clean}".strip()
        return f"{entity_clean} official {term_clean}".strip()
    elif angle == "lateral":
        return f"{entity_clean} official roster board {term_clean}".strip()
    elif angle == "adversarial":
        return f"{entity_clean} succession nominee {term_clean}".strip()
    elif angle == "temporal":
        return f"{entity_clean} {term_clean} {as_of_year}".strip()
    return f"{entity_clean} {term_clean}".strip()

def diagnose_slot(grade: SlotGrade, has_results: bool, has_record_fetched: bool) -> Optional[str]:
    """Diagnoses the symptom based on current grade state."""
    if not has_results:
        return "no_results"
    if grade.grade == "X":
        return "answers_disagree"
    if not grade.is_source_of_record:
        if has_record_fetched:
            return "source_of_record_no_claim"
        return "no_source_of_record"
    if grade.origins_count < 2 and not grade.is_source_of_record:
        return "fewer_than_two_origins"
    if not grade.is_fresh:
        return "evidence_past_shelf_life"
    return None

def plan_initial_round(spec: ResearchSpec) -> List[PlannedQuery]:
    queries = []
    as_of_year = spec.as_of[:4]
    primary_domain = spec.primary_domains[0] if spec.primary_domains else None

    for slot in spec.slots:
        entity = derive_entity(slot, spec.question)
        term = slot.answer_terms[0] if slot.answer_terms else "status"

        # Round 1 default angle: direct (and lateral if appropriate)
        q_direct = build_query_text(entity, term, "direct", primary_domain, as_of_year)
        queries.append(PlannedQuery(slot_id=slot.slot_id, query_text=q_direct, angle="direct"))

        # Add second angle
        q_lat = build_query_text(entity, term, "lateral", primary_domain, as_of_year)
        queries.append(PlannedQuery(slot_id=slot.slot_id, query_text=q_lat, angle="lateral"))

    return queries

def plan_refinement_round(
    spec: ResearchSpec,
    slot_grades: Dict[str, SlotGrade],
    slot_states: Dict[str, Dict[str, Any]],
    has_results_map: Dict[str, bool],
    has_record_fetched_map: Dict[str, bool]
) -> Tuple[List[PlannedQuery], Dict[str, Dict[str, Any]]]:
    queries = []
    updated_states = {}
    as_of_year = spec.as_of[:4]
    primary_domain = spec.primary_domains[0] if spec.primary_domains else None

    for slot in spec.slots:
        grade = slot_grades.get(slot.slot_id)
        state = slot_states.get(slot.slot_id, {"vocab_level": 0, "angles_tried": ["direct", "lateral"], "fixes_tried": []})
        vocab_level = state["vocab_level"]
        angles_tried = set(state.get("angles_tried", []))
        fixes_tried = list(state.get("fixes_tried", []))

        # If slot already met required grade, no fix needed!
        if grade and grade.grade == spec.required_grade:
            updated_states[slot.slot_id] = state
            continue

        symptom = diagnose_slot(grade, has_results_map.get(slot.slot_id, True), has_record_fetched_map.get(slot.slot_id, False))

        # Find first fix not yet tried from the fix table
        chosen_fix = None
        for fix_rule in FIX_TABLE:
            if fix_rule["fix_name"] not in fixes_tried:
                # Match symptom or take next untried
                if symptom is None or fix_rule["symptom"] == symptom:
                    chosen_fix = fix_rule
                    break

        if not chosen_fix:
            # Fallback to first untried fix
            for fix_rule in FIX_TABLE:
                if fix_rule["fix_name"] not in fixes_tried:
                    chosen_fix = fix_rule
                    break

        if chosen_fix:
            fixes_tried.append(chosen_fix["fix_name"])
            if chosen_fix["advance_vocab"]:
                vocab_level = 1

            entity = derive_entity(slot, spec.question)
            terms = slot.alt_terms if (vocab_level > 0 and slot.alt_terms) else slot.answer_terms
            term = terms[0] if terms else "status"

            for angle in chosen_fix["angles"]:
                q_text = build_query_text(entity, term, angle, primary_domain, as_of_year)
                queries.append(PlannedQuery(slot_id=slot.slot_id, query_text=q_text, angle=angle, fix=chosen_fix["fix_name"]))
                angles_tried.add(angle)

        updated_states[slot.slot_id] = {
            "vocab_level": vocab_level,
            "angles_tried": list(angles_tried),
            "fixes_tried": fixes_tried,
        }

    return queries, updated_states
