import json
import re
import html as html_lib
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any
from .http import fetch_url
from .util import clean_text

@dataclass
class FetchedPage:
    url: str
    status_code: int
    text: str
    html: Optional[str] = None
    published_date: Optional[str] = None
    updated_date: Optional[str] = None
    title: Optional[str] = None

def extract_dates_from_html(html_content: str) -> tuple[Optional[str], Optional[str]]:
    published_date = None
    updated_date = None

    # 1. JSON-LD check
    json_ld_matches = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html_content, re.DOTALL | re.IGNORECASE)
    for block in json_ld_matches:
        try:
            data = json.loads(block.strip())
            items = data if isinstance(data, list) else [data]
            for it in items:
                if isinstance(it, dict):
                    pub = it.get("datePublished") or it.get("dateCreated")
                    mod = it.get("dateModified")
                    if pub and not published_date:
                        published_date = str(pub)[:10]
                    if mod and not updated_date:
                        updated_date = str(mod)[:10]
        except Exception:
            pass

    # 2. Meta tags check
    meta_patterns = [
        (r'<meta[^>]*property=[\'"](?:article:published_time|og:published_time)[\'"][^>]*content=[\'"]([^\'"]+)[\'"]', True),
        (r'<meta[^>]*name=[\'"](?:date|pubdate|published_date|DC\.date\.issued|sailthru\.date)[\'"][^>]*content=[\'"]([^\'"]+)[\'"]', True),
        (r'<meta[^>]*property=[\'"](?:article:modified_time|og:updated_time)[\'"][^>]*content=[\'"]([^\'"]+)[\'"]', False),
        (r'<meta[^>]*name=[\'"](?:last-modified|updated_date)[\'"][^>]*content=[\'"]([^\'"]+)[\'"]', False),
    ]

    for pat, is_pub in meta_patterns:
        m = re.search(pat, html_content, re.IGNORECASE)
        if m:
            d_str = m.group(1).strip()[:10]
            if re.match(r"^\d{4}-\d{2}-\d{2}$", d_str):
                if is_pub and not published_date:
                    published_date = d_str
                elif not is_pub and not updated_date:
                    updated_date = d_str

    return published_date, updated_date

def extract_text_from_html(html_content: str) -> str:
    # Remove script, style, comments
    text = re.sub(r"<!--.*?-->", " ", html_content, flags=re.DOTALL)
    text = re.sub(r"<(script|style|nav|footer|header|svg|noscript)[^>]*>.*?</\1>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    # Replace block tags with newlines
    text = re.sub(r"<(p|div|h[1-6]|li|tr|br)[^>]*>", "\n", text, flags=re.IGNORECASE)
    # Remove all remaining tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode entities
    text = html_lib.unescape(text)
    # Normalize spaces
    lines = [clean_text(line) for line in text.splitlines()]
    return "\n".join(l for l in lines if l)

def extract_title_from_html(html_content: str) -> Optional[str]:
    m = re.search(r"<title[^>]*>(.*?)</title>", html_content, re.IGNORECASE | re.DOTALL)
    if m:
        return clean_text(html_lib.unescape(m.group(1)))
    return None

def fetch_page(url: str, fixture_pages: Optional[Dict[str, Any]] = None, user_agent: str = "ResearchLoopBot/1.0") -> FetchedPage:
    if fixture_pages and url in fixture_pages:
        data = fixture_pages[url]
        return FetchedPage(
            url=url,
            status_code=data.get("status_code", 200),
            text=data.get("text", ""),
            html=data.get("html"),
            published_date=data.get("published_date"),
            updated_date=data.get("updated_date"),
            title=data.get("title"),
        )

    code, body = fetch_url(url, user_agent=user_agent)
    if code != 200:
        return FetchedPage(url=url, status_code=code, text="", html=body)

    text = extract_text_from_html(body)
    pub_date, mod_date = extract_dates_from_html(body)
    title = extract_title_from_html(body)

    return FetchedPage(
        url=url,
        status_code=code,
        text=text,
        html=body,
        published_date=pub_date,
        updated_date=mod_date,
        title=title,
    )
