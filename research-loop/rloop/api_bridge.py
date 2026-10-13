"""JSON bridge for HTTP callers. Arguments are paths passed via execFile, never shell code."""
import contextlib
import io
import json
import sys
from .spec import validate_spec_data
from .store import Store
from .providers import get_provider
from .loop import ResearchLoop
from .report import generate_report_markdown
from .decay import schedule_recheck
from .dump_db import dump_db
from pathlib import Path


def execute(action, request):
    if action == 'validate':
        validate_spec_data(request['spec'])
        return {'valid': True}
    store = Store(request['db'])
    run_id = request['runId']
    if action == 'run':
        spec = validate_spec_data(request['spec'])
        fixture_pages = {}
        if request['provider'] == 'fixture':
            fixture = json.loads((Path(__file__).parent.parent / 'tests/fixtures/fed_chair.json').read_text())
            provider = get_provider('fixture', fixture_path=fixture['queries'])
            fixture_pages = fixture['pages']
        else:
            provider = get_provider(request['provider'])
        loop = ResearchLoop(spec=spec, store=store, provider=provider, fixture_pages=fixture_pages)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = loop.run(run_id)
        if request.get('watch'):
            schedule_recheck(run_id, spec.as_of, spec.shelf_life_days, store)
        logs = output.getvalue() + f"Run finished: {result['stop_reason']} ({result['rounds']} rounds)"
    elif action == 'override':
        run = store.get_run(run_id)
        if not run:
            raise ValueError('Research run not found')
        spec = validate_spec_data(json.loads(run['spec_json']))
        if request['slotId'] not in [s.slot_id for s in spec.slots]:
            raise ValueError('Unknown slot')
        store.save_override(run_id, request['slotId'], request['grade'], request['reason'])
        logs = 'Human override recorded'
    else:
        raise ValueError('Unsupported bridge action')
    report = generate_report_markdown(spec, run_id, store)
    Path(request['output']).write_text(report, encoding='utf-8')
    store.conn.close()
    return {'execOutput': logs, 'dbState': dump_db(request['db']), 'reportMd': report}


if __name__ == '__main__':
    try:
        result = execute(sys.argv[1], json.loads(Path(sys.argv[2]).read_text()))
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'error': str(error)}))
        sys.exit(1)
