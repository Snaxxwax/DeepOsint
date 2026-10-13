# Research Loop

A deterministic research system that takes one question and produces a graded, cited, archived brief. Resumes any run from its last completed stage using a file-backed SQLite state machine.

## Four Design Rules

1. **Deterministic where possible, LLM only for judgment.** Deduplication, verification, grading and the stop rule are plain code.
2. **File-backed state.** Each stage writes to one SQLite file before the next starts.
3. **Swappable edges.** Search, fetch, and claim extraction sit behind three small interfaces.
4. **No required dependencies.** Standard library runs everything.

## Quickstart

```bash
cd research-loop
python3 -m unittest -v
python3 -m rloop run examples/fed_chair.spec.json --provider fixture --fixture tests/fixtures/fed_chair.json
```
