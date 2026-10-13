"""Bounded HTTP fetching with DNS-pinned public addresses and redirect validation."""
import http.client
import ipaddress
import socket
import ssl
import time
import urllib.robotparser
from urllib.parse import urlparse, urljoin
from typing import Dict, Tuple

_ROBOTS_CACHE: Dict[str, urllib.robotparser.RobotFileParser] = {}
_LAST_REQUEST_TIME: Dict[str, float] = {}
RATE_LIMIT_DELAY = 0.5
MAX_BYTES = 2 * 1024 * 1024


def public_target(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Only public HTTP(S) URLs without credentials are allowed')
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    if port not in (80, 443) or parsed.hostname.endswith(('.onion', '.localhost', '.local')):
        raise ValueError('Unsupported destination')
    addresses = socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
    if not addresses or any((not ipaddress.ip_address(a[4][0]).is_global or ipaddress.ip_address(a[4][0]).is_multicast) for a in addresses):
        raise ValueError('Private or reserved network destination blocked')
    return parsed, port, addresses[0][4][0]


class PinnedHTTP(http.client.HTTPConnection):
    def __init__(self, host, port, address, timeout):
        super().__init__(host, port, timeout=timeout)
        self.address = address

    def connect(self):
        self.sock = socket.create_connection((self.address, self.port), self.timeout)


class PinnedHTTPS(PinnedHTTP):
    def connect(self):
        super().connect()
        self.sock = ssl.create_default_context().wrap_socket(self.sock, server_hostname=self.host)


def request_public(url, user_agent, timeout=10, redirects=0):
    parsed, port, address = public_target(url)
    connection_type = PinnedHTTPS if parsed.scheme == 'https' else PinnedHTTP
    conn = connection_type(parsed.hostname, port, address, timeout)
    try:
        target = parsed.path or '/'
        if parsed.query:
            target += '?' + parsed.query
        conn.request('GET', target, headers={'User-Agent': user_agent, 'Accept': 'text/html,text/plain', 'Accept-Encoding': 'identity'})
        response = conn.getresponse()
        if response.status in (301, 302, 303, 307, 308):
            if redirects >= 3 or not response.getheader('Location'):
                raise ValueError('Redirect limit exceeded')
            return request_public(urljoin(url, response.getheader('Location')), user_agent, timeout, redirects + 1)
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError('Response exceeds size limit')
        return response.status, body.decode('utf-8', errors='replace')
    finally:
        conn.close()


def can_fetch(url: str, user_agent: str = 'ResearchLoopBot/1.0') -> bool:
    parsed = urlparse(url)
    origin = f'{parsed.scheme}://{parsed.netloc}'
    if origin not in _ROBOTS_CACHE:
        rp = urllib.robotparser.RobotFileParser()
        try:
            code, body = request_public(origin + '/robots.txt', user_agent, timeout=5)
            if code in (401, 403):
                rp.disallow_all = True
            elif code == 404:
                rp.allow_all = True
            elif code == 200:
                rp.parse(body.splitlines())
            else:
                rp.disallow_all = True
        except Exception:
            rp.disallow_all = True
        _ROBOTS_CACHE[origin] = rp
    return _ROBOTS_CACHE[origin].can_fetch(user_agent, url)


def fetch_url(url: str, user_agent: str = 'ResearchLoopBot/1.0', timeout: int = 10) -> Tuple[int, str]:
    try:
        public_target(url)  # Validate before any robots fetch.
        host = urlparse(url).netloc
        elapsed = time.monotonic() - _LAST_REQUEST_TIME.get(host, 0)
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        if not can_fetch(url, user_agent):
            return 403, 'Blocked by robots.txt'
        _LAST_REQUEST_TIME[host] = time.monotonic()
        return request_public(url, user_agent, timeout)
    except ValueError as error:
        return 403, str(error)
    except Exception:
        return 502, 'Page fetch failed'
