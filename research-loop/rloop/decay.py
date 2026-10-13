from datetime import timedelta
from .util import parse_iso_date
from .store import Store

def schedule_recheck(run_id: str, as_of_str: str, shelf_life_days: int, store: Store) -> str:
    as_of = parse_iso_date(as_of_str)
    recheck_date = (as_of + timedelta(days=shelf_life_days)).isoformat()
    store.set_watch(run_id, recheck_date)
    return recheck_date
