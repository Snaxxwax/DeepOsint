import argparse
import json
import os
import sys
from .spec import load_spec
from .store import Store
from .providers import get_provider
from .loop import ResearchLoop
from .report import generate_report_markdown
from .decay import schedule_recheck

def main(args=None):
    parser = argparse.ArgumentParser(prog="rloop", description="Deterministic Research Loop")
    subparsers = parser.add_subparsers(dest="command")

    # Run command
    run_parser = subparsers.add_parser("run", help="Run a research spec")
    run_parser.add_argument("spec", help="Path to spec JSON file")
    run_parser.add_argument("--provider", default="fixture", help="Search provider (fixture, brave, tavily)")
    run_parser.add_argument("--fixture", help="Path to fixture JSON file")
    run_parser.add_argument("--llm", action="store_true", help="Enable LLM extraction")
    run_parser.add_argument("--archive", action="store_true", help="Snapshot cited pages")
    run_parser.add_argument("--watch", action="store_true", help="Add to decay watch schedule")
    run_parser.add_argument("--db", default="rloop.sqlite", help="SQLite database path")
    run_parser.add_argument("--output", help="Path to write report markdown (default report-1.md)")

    # Resume command
    resume_parser = subparsers.add_parser("resume", help="Resume an interrupted run")
    resume_parser.add_argument("run_id", help="Run ID to resume")
    resume_parser.add_argument("--db", default="rloop.sqlite", help="SQLite database path")

    # Override command
    override_parser = subparsers.add_parser("override", help="Record a human grade override with written reason")
    override_parser.add_argument("run_id", help="Run ID")
    override_parser.add_argument("slot", help="Slot ID")
    override_parser.add_argument("grade", help="New grade (A, B, C, D, X)")
    override_parser.add_argument("--reason", required=True, help="Written justification")
    override_parser.add_argument("--db", default="rloop.sqlite", help="SQLite database path")

    # Watch command
    watch_parser = subparsers.add_parser("watch", help="Manage decay watch schedule")
    watch_sub = watch_parser.add_subparsers(dest="watch_action")
    watch_add = watch_sub.add_parser("add", help="Add run to watch")
    watch_add.add_argument("run_id", help="Run ID")
    watch_add.add_argument("--db", default="rloop.sqlite", help="SQLite database path")

    # Recheck command
    recheck_parser = subparsers.add_parser("recheck", help="Run due decay watches")
    recheck_parser.add_argument("--provider", default="brave", help="Search provider")
    recheck_parser.add_argument("--db", default="rloop.sqlite", help="SQLite database path")

    parsed = parser.parse_args(args)
    if not parsed.command:
        parser.print_help()
        return 0

    if parsed.command == "run":
        spec = load_spec(parsed.spec)
        store = Store(parsed.db)
        fixture_pages = {}

        if parsed.provider == "fixture":
            if not parsed.fixture:
                print("Error: --fixture path is required when using fixture provider", file=sys.stderr)
                return 1
            with open(parsed.fixture, "r", encoding="utf-8") as f:
                f_data = json.load(f)
                fixture_provider_data = f_data.get("queries", f_data)
                fixture_pages = f_data.get("pages", {})
            provider = get_provider("fixture", fixture_path=fixture_provider_data)
        else:
            provider = get_provider(parsed.provider)

        loop = ResearchLoop(
            spec=spec,
            store=store,
            provider=provider,
            fixture_pages=fixture_pages,
            use_llm=parsed.llm,
            archive_cited=parsed.archive,
        )

        run_id = f"run_{spec.as_of}_{int(spec.shelf_life_days)}"
        print(f"[*] Starting research loop for: {spec.question}")
        print(f"[*] Provider: {parsed.provider} | DB: {parsed.db}")

        result = loop.run(run_id)
        print(f"[+] Run finished in {result['rounds']} rounds: {result['stop_reason']}")

        # Generate report
        report_md = generate_report_markdown(spec, run_id, store)
        out_path = parsed.output or "report-1.md"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(report_md)
        print(f"[+] Report written to {out_path}")

        if parsed.watch:
            rdate = schedule_recheck(run_id, spec.as_of, spec.shelf_life_days, store)
            print(f"[+] Scheduled decay recheck on {rdate}")

        return 0

    elif parsed.command == "override":
        store = Store(parsed.db)
        store.save_override(parsed.run_id, parsed.slot, parsed.grade.upper(), parsed.reason)
        print(f"[+] Recorded override for run {parsed.run_id}, slot {parsed.slot} -> {parsed.grade.upper()}: {parsed.reason}")
        return 0

    elif parsed.command == "resume":
        store = Store(parsed.db)
        run_rec = store.get_run(parsed.run_id)
        if not run_rec:
            print(f"Error: run {parsed.run_id} not found in {parsed.db}", file=sys.stderr)
            return 1
        spec_data = json.loads(run_rec["spec_json"])
        from .spec import validate_spec_data
        spec = validate_spec_data(spec_data)
        provider = get_provider(run_rec["provider"])
        loop = ResearchLoop(spec=spec, store=store, provider=provider)
        res = loop.run(parsed.run_id)
        print(f"[+] Resumed run finished in {res['rounds']} rounds: {res['stop_reason']}")
        return 0

    return 0
