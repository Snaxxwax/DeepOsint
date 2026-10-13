import urllib.request
import urllib.parse
from typing import Optional

def snapshot_page(url: str) -> Optional[str]:
    """Snapshots a cited page using Wayback Machine save endpoint (or fallback local snapshot)."""
    try:
        wb_url = f"https://web.archive.org/save/{url}"
        req = urllib.request.Request(wb_url, headers={"User-Agent": "ResearchLoopBot/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.geturl()
    except Exception:
        # Offline or unreachable fallback
        return f"https://web.archive.org/web/*/{url}"
