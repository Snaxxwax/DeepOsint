import time
import urllib.request
import urllib.robotparser
from urllib.parse import urlparse
from typing import Dict, Tuple, Optional

_ROBOTS_CACHE: Dict[str, urllib.robotparser.RobotFileParser] = {}
_LAST_REQUEST_TIME: Dict[str, float] = {}
RATE_LIMIT_DELAY = 0.5  # seconds between requests to same host

def can_fetch(url: str, user_agent: str = "ResearchLoopBot/1.0") -> bool:
    parsed = urlparse(url)
    host = parsed.netloc
    if not host:
        return True

    if host not in _ROBOTS_CACHE:
        rp = urllib.robotparser.RobotFileParser()
        robots_url = f"{parsed.scheme}://{host}/robots.txt"
        rp.set_url(robots_url)
        try:
            req = urllib.request.Request(robots_url, headers={"User-Agent": user_agent})
            with urllib.request.urlopen(req, timeout=5) as resp:
                rp.parse(resp.read().decode("utf-8", errors="ignore").splitlines())
        except Exception:
            # If robots.txt cannot be reached, allow by default
            rp.allow_all = True
        _ROBOTS_CACHE[host] = rp

    rp = _ROBOTS_CACHE[host]
    return rp.can_fetch(user_agent, url)

def fetch_url(url: str, user_agent: str = "ResearchLoopBot/1.0", timeout: int = 10) -> Tuple[int, str]:
    parsed = urlparse(url)
    host = parsed.netloc

    # Rate limiting
    last_time = _LAST_REQUEST_TIME.get(host, 0)
    elapsed = time.time() - last_time
    if elapsed < RATE_LIMIT_DELAY:
        time.sleep(RATE_LIMIT_DELAY - elapsed)

    if not can_fetch(url, user_agent):
        return 403, "Blocked by robots.txt"

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    _LAST_REQUEST_TIME[host] = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode("utf-8", errors="replace")
            return resp.status, content
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except Exception as e:
        return 500, str(e)
