from typing import List, Dict, Any, Optional
from .spec import ResearchSpec
from .store import Store

def generate_report_markdown(spec: ResearchSpec, run_id: str, store: Store) -> str:
    run = store.get_run(run_id)
    grades = store.get_grades_for_run(run_id)
    queries = store.get_queries_for_run(run_id)
    results = store.get_results_for_run(run_id)
    claims = store.get_claims_for_run(run_id)
    overrides = store.get_overrides(run_id)
    events = store.get_events(run_id)

    # Get latest grade per slot
    latest_grades: Dict[str, Any] = {}
    for g in grades:
        latest_grades[g["slot_id"]] = g

    lines = []
    lines.append(f"# Research Brief: {spec.question}\n")
    lines.append(f"- **Run ID**: `{run_id}`")
    lines.append(f"- **As of Date**: `{spec.as_of}`")
    lines.append(f"- **Fact Class**: `{spec.fact_class}` (Shelf life: {spec.shelf_life_days} days)")
    lines.append(f"- **Required Grade**: `{spec.required_grade}`")
    lines.append(f"- **Status / Stop Reason**: `{run['stop_reason'] or 'Completed'}`")
    lines.append(f"- **Total Rounds**: `{run['round']}`\n")

    # 1. Answers Table
    lines.append("## Answers\n")
    lines.append("| Sub-Question | Answer | Grade | Origins | Source of Record | Notes |")
    lines.append("| :--- | :--- | :---: | :---: | :---: | :--- |")

    for slot in spec.slots:
        g = latest_grades.get(slot.slot_id)
        if g:
            ans = g["answer_value"]
            gr = g["grade"]
            origs = g["origins_count"]
            sor = "Yes" if "record" in (g["notes"] or "").lower() else "No"
            notes = g["notes"] or ""
        else:
            ans = "Unresolved"
            gr = "D"
            origs = 0
            sor = "No"
            notes = "No data"

        # Check for override
        ov = next((o for o in overrides if o["slot_id"] == slot.slot_id), None)
        if ov:
            gr = f"{gr} -> {ov['grade']} (Override)"
            notes += f" [Override: {ov['reason']}]"

        lines.append(f"| {slot.question} | **{ans}** | **{gr}** | {origs} | {sor} | {notes} |")
    lines.append("")

    # 2. Citations
    lines.append("## Citations\n")
    cited_urls = set()
    for c in claims:
        if c["verified"]:
            cited_urls.add(c["url"])

    if cited_urls:
        for idx, u in enumerate(sorted(cited_urls), 1):
            p = store.get_page(u)
            title = p["text"][:60].replace("\n", " ") if p else u
            pub = (p["published_date"] if p else None) or "Unknown date"
            orig = (p["origin_id"] if p else "unknown")
            lines.append(f"{idx}. [{title}]({u}) — Origin: `{orig}` | Published: `{pub}`")
    else:
        lines.append("*No verified citations collected.*")
    lines.append("")

    # 3. Alternatives Considered
    lines.append("## Alternatives Considered\n")
    unverified = [c for c in claims if not c["verified"]]
    if unverified:
        for c in unverified[:5]:
            lines.append(f"- Candidate `{c['value']}` from `{c['url']}`: Rejected ({c['reason']})")
    else:
        lines.append("- None rejected.")
    lines.append("")

    # 4. Hop Log (Queries)
    lines.append("## Hop Log\n")
    lines.append("| Round | Slot | Angle | Fix | Results | Query |")
    lines.append("| :---: | :---: | :---: | :---: | :---: | :--- |")
    for q in queries:
        fix_str = q["fix"] or "initial"
        lines.append(f"| {q['round']} | {q['slot_id']} | `{q['angle']}` | `{fix_str}` | {q['result_count']} | `{q['query_text']}` |")
    lines.append("")

    # 5. Event History
    lines.append("## Decision Events\n")
    for ev in events:
        lines.append(f"- Round {ev['round']} [{ev['stage']}]: `{ev['event_type']}` — `{ev['payload_json']}`")
    lines.append("")

    # 6. Human Sign-Off
    lines.append("## Human Sign-Off\n")
    if overrides:
        lines.append("### Recorded Overrides:")
        for ov in overrides:
            lines.append(f"- Slot `{ov['slot_id']}` changed to **{ov['grade']}**: *\"{ov['reason']}\"*")
        lines.append("")

    lines.append("```")
    lines.append("Verdict Reviewer Sign-Off:")
    lines.append("Reviewed and signed by: ___________________________    Date: ______________")
    lines.append("```\n")

    return "\n".join(lines)
