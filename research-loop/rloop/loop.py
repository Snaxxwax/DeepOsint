import json
import time
from typing import Dict, Any, List, Optional
from .spec import ResearchSpec
from .store import Store
from .providers import SearchProvider
from .fetch import fetch_page
from .provenance import assign_origins
from .claims import extract_claims_deterministic
from .grade import grade_slot, SlotGrade
from .planner import plan_initial_round, plan_refinement_round, PlannedQuery

class ResearchLoop:
    def __init__(
        self,
        spec: ResearchSpec,
        store: Store,
        provider: SearchProvider,
        fixture_pages: Optional[Dict[str, Any]] = None,
        use_llm: bool = False,
        archive_cited: bool = False,
    ):
        self.spec = spec
        self.store = store
        self.provider = provider
        self.fixture_pages = fixture_pages or {}
        self.use_llm = use_llm
        self.archive_cited = archive_cited

    def run(self, run_id: str, max_rounds: Optional[int] = None) -> Dict[str, Any]:
        limit_rounds = max_rounds or self.spec.max_rounds
        self.store.create_run(run_id, json.dumps(self.spec.to_dict()), self.provider.name)

        # Resume state check
        run_record = self.store.get_run(run_id)
        current_round = run_record["round"] if run_record else 1
        current_stage = run_record["stage_marker"] if run_record else "planned"

        if current_stage == "completed":
            return {
                "run_id": run_id,
                "rounds": current_round,
                "stop_reason": run_record["stop_reason"],
                "grades": [dict(g) for g in self.store.get_grades_for_run(run_id)],
            }

        flat_rounds_count = 0
        previous_grades_signature = None

        while current_round <= limit_rounds:
            # 1. Stage: planned
            if current_stage == "planned":
                if current_round == 1:
                    planned = plan_initial_round(self.spec)
                else:
                    # Gather state for refinement
                    slot_grades = {}
                    for g in self.store.get_grades_for_run(run_id, current_round - 1):
                        slot_grades[g["slot_id"]] = SlotGrade(
                            slot_id=g["slot_id"],
                            answer_value=g["answer_value"],
                            grade=g["grade"],
                            origins_count=g["origins_count"],
                            is_source_of_record="record" in (g["notes"] or "").lower(),
                            is_fresh=g["shelf_life_status"] == "fresh",
                            shelf_life_status=g["shelf_life_status"],
                            notes=g["notes"] or "",
                        )

                    slot_states = {}
                    for s in self.spec.slots:
                        v, a_tried, f_tried = self.store.get_slot_state(run_id, s.slot_id)
                        slot_states[s.slot_id] = {
                            "vocab_level": v,
                            "angles_tried": a_tried,
                            "fixes_tried": f_tried,
                        }

                    # Check if previous results had results
                    results = self.store.get_results_for_run(run_id)
                    has_results_map = {s.slot_id: False for s in self.spec.slots}
                    for r in results:
                        has_results_map[r["slot_id"]] = True

                    # Check if primary record was fetched
                    has_record_fetched = {s.slot_id: False for s in self.spec.slots}
                    for r in results:
                        for pd in self.spec.primary_domains:
                            if pd in r["url"]:
                                has_record_fetched[r["slot_id"]] = True

                    planned, updated_states = plan_refinement_round(
                        self.spec, slot_grades, slot_states, has_results_map, has_record_fetched
                    )
                    for s_id, s_data in updated_states.items():
                        self.store.update_slot_state(
                            run_id, s_id, s_data["vocab_level"], s_data["angles_tried"], s_data["fixes_tried"]
                        )

                for q in planned:
                    self.store.save_query(run_id, current_round, q.slot_id, q.query_text, q.angle, q.fix)

                current_stage = "searched"
                self.store.update_run_stage(run_id, current_round, "searched")
                self.store.log_event(run_id, current_round, "plan", "queries_planned", {"count": len(planned)})

            # 2. Stage: searched
            if current_stage == "searched":
                queries = [q for q in self.store.get_queries_for_run(run_id) if q["round"] == current_round]
                for q in queries:
                    # Skip if already has results recorded
                    existing_res = [r for r in self.store.get_results_for_run(run_id) if r["query_id"] == q["query_id"]]
                    if existing_res:
                        continue

                    try:
                        results = self.provider.search(q["query_text"], count=self.spec.results_per_query)
                        self.store.save_results(
                            q["query_id"],
                            [
                                {
                                    "url": r.url,
                                    "title": r.title,
                                    "snippet": r.snippet,
                                    "rank": r.rank,
                                    "provider": r.provider,
                                    "published_date": r.published_date,
                                }
                                for r in results
                            ],
                        )
                        self.store.update_query_results(q["query_id"], len(results))
                    except Exception as err:
                        self.store.update_query_results(q["query_id"], 0, error=str(err))

                current_stage = "fetched"
                self.store.update_run_stage(run_id, current_round, "fetched")
                self.store.log_event(run_id, current_round, "search", "search_completed", {"round": current_round})

            # 3. Stage: fetched
            if current_stage == "fetched":
                all_results = self.store.get_results_for_run(run_id)
                urls_to_fetch = set(r["url"] for r in all_results)

                # Fetch pages
                fetched_items = []
                for u in urls_to_fetch:
                    p = self.store.get_page(u)
                    if not p:
                        fp = fetch_page(u, fixture_pages=self.fixture_pages)
                        fetched_items.append({"url": u, "text": fp.text, "html": fp.html, "pub": fp.published_date, "mod": fp.updated_date, "code": fp.status_code})
                    else:
                        fetched_items.append({"url": u, "text": p["text"], "html": p["html"], "pub": p["published_date"], "mod": p["updated_date"], "code": p["status_code"]})

                # Provenance clustering
                url_origins = assign_origins(fetched_items)

                for item in fetched_items:
                    orig_id = url_origins.get(item["url"], item["url"])
                    self.store.save_page(
                        url=item["url"],
                        origin_id=orig_id,
                        text=item["text"],
                        html=item["html"],
                        published_date=item["pub"],
                        updated_date=item["mod"],
                        status_code=item["code"],
                    )

                current_stage = "extracted"
                self.store.update_run_stage(run_id, current_round, "extracted")
                self.store.log_event(run_id, current_round, "fetch", "fetch_and_clustering_completed", {"pages": len(fetched_items)})

            # 4. Stage: extracted
            if current_stage == "extracted":
                all_results = self.store.get_results_for_run(run_id)
                for slot in self.spec.slots:
                    v_level, _, _ = self.store.get_slot_state(run_id, slot.slot_id)
                    slot_urls = set(r["url"] for r in all_results if r["slot_id"] == slot.slot_id)

                    for u in slot_urls:
                        p = self.store.get_page(u)
                        if p and p["text"]:
                            claims = extract_claims_deterministic(p["text"], u, slot, vocab_level=v_level)
                            for c in claims:
                                self.store.save_claim(
                                    run_id=run_id,
                                    slot_id=c.slot_id,
                                    url=c.url,
                                    value=c.value,
                                    sentence=c.sentence,
                                    verified=c.verified,
                                    reason=c.reason,
                                    extracted_by=c.extracted_by,
                                )

                current_stage = "graded"
                self.store.update_run_stage(run_id, current_round, "graded")
                self.store.log_event(run_id, current_round, "extract", "claim_extraction_completed", {"round": current_round})

            # 5. Stage: graded
            if current_stage == "graded":
                pages_map = {}
                for r in self.store.get_results_for_run(run_id):
                    p = self.store.get_page(r["url"])
                    if p:
                        pages_map[r["url"]] = dict(p)

                round_grades = []
                for slot in self.spec.slots:
                    claims = [dict(c) for c in self.store.get_claims_for_run(run_id, slot.slot_id) if c["verified"]]
                    g = grade_slot(
                        slot.slot_id,
                        claims,
                        pages_map,
                        self.spec.primary_domains,
                        self.spec.as_of,
                        self.spec.shelf_life_days,
                    )
                    self.store.save_grade(
                        run_id=run_id,
                        round_num=current_round,
                        slot_id=slot.slot_id,
                        answer_value=g.answer_value,
                        grade=g.grade,
                        origins_count=g.origins_count,
                        notes=g.notes,
                        shelf_life_status=g.shelf_life_status,
                    )
                    round_grades.append(g)

                current_signature = tuple((g.slot_id, g.grade, g.answer_value) for g in round_grades)
                if previous_grades_signature == current_signature:
                    flat_rounds_count += 1
                else:
                    flat_rounds_count = 0
                previous_grades_signature = current_signature

                # Stop rule checks
                all_met = all(g.grade == self.spec.required_grade for g in round_grades)
                if all_met:
                    stop_reason = "Stop: both met" if len(round_grades) == 2 else "Stop: all grades met"
                    self.store.update_run_stage(run_id, current_round, "completed", stop_reason=stop_reason)
                    self.store.log_event(run_id, current_round, "decide", "stop_criteria_met", {"reason": stop_reason})
                    break

                if flat_rounds_count >= 3:
                    stop_reason = "Stop: three flat rounds without grade change"
                    self.store.update_run_stage(run_id, current_round, "completed", stop_reason=stop_reason)
                    self.store.log_event(run_id, current_round, "decide", "stop_three_flat_rounds", {"reason": stop_reason})
                    break

                if current_round >= limit_rounds:
                    stop_reason = "Stop: max rounds reached"
                    self.store.update_run_stage(run_id, current_round, "completed", stop_reason=stop_reason)
                    break

                # Advance round
                current_round += 1
                current_stage = "planned"
                self.store.update_run_stage(run_id, current_round, "planned")
                self.store.log_event(run_id, current_round, "decide", "refinement_round_started", {"next_round": current_round})

        return {
            "run_id": run_id,
            "rounds": current_round,
            "stop_reason": self.store.get_run(run_id)["stop_reason"],
            "grades": [dict(g) for g in self.store.get_grades_for_run(run_id)],
        }
