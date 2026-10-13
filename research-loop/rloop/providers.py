import json
import os
import re
import urllib.request
import urllib.parse
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str
    rank: int
    provider: str
    published_date: Optional[str] = None

class SearchProvider:
    name: str = "base"

    def search(self, query: str, count: int = 8) -> List[SearchResult]:
        raise NotImplementedError

class FixtureProvider(SearchProvider):
    name: str = "fixture"

    def __init__(self, fixture_data_or_path: Any):
        if isinstance(fixture_data_or_path, str):
            with open(fixture_data_or_path, "r", encoding="utf-8") as f:
                self.fixtures = json.load(f)
        else:
            self.fixtures = fixture_data_or_path

    def search(self, query: str, count: int = 8) -> List[SearchResult]:
        query_clean = query.strip().lower()
        items = []

        # Try exact query match
        if query_clean in self.fixtures:
            items = self.fixtures[query_clean]
        elif query in self.fixtures:
            items = self.fixtures[query]
        else:
            # Match by normalized query or best substring
            best_match = None
            best_score = 0
            q_tokens = set(re.findall(r"\w+", query_clean))
            for k, val in self.fixtures.items():
                k_tokens = set(re.findall(r"\w+", k.lower()))
                overlap = len(q_tokens & k_tokens)
                if overlap > best_score:
                    best_score = overlap
                    best_match = val
            if best_match:
                items = best_match

        results = []
        for idx, item in enumerate(items[:count]):
            results.append(
                SearchResult(
                    url=item["url"],
                    title=item.get("title", ""),
                    snippet=item.get("snippet", ""),
                    rank=idx + 1,
                    provider=self.name,
                    published_date=item.get("published_date"),
                )
            )
        return results

class BraveProvider(SearchProvider):
    name: str = "brave"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("BRAVE_API_KEY", "")

    def search(self, query: str, count: int = 8) -> List[SearchResult]:
        if not self.api_key:
            raise ValueError("BRAVE_API_KEY is not set")
        url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count={count}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "X-Subscription-Token": self.api_key,
                "User-Agent": os.environ.get("RLOOP_CONTACT", "research-loop/1.0"),
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        web_results = data.get("web", {}).get("results", [])
        results = []
        for idx, item in enumerate(web_results[:count]):
            results.append(
                SearchResult(
                    url=item.get("url", ""),
                    title=item.get("title", ""),
                    snippet=item.get("description", ""),
                    rank=idx + 1,
                    provider=self.name,
                    published_date=item.get("page_age") or item.get("published_date"),
                )
            )
        return results

class TavilyProvider(SearchProvider):
    name: str = "tavily"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("TAVILY_API_KEY", "")

    def search(self, query: str, count: int = 8) -> List[SearchResult]:
        if not self.api_key:
            raise ValueError("TAVILY_API_KEY is not set")

        # Design rule: Move 'site:domain' into Tavily's include_domains filter!
        include_domains = []
        site_match = re.search(r"\bsite:([A-Za-z0-9.-]+)", query)
        clean_query = query
        if site_match:
            include_domains.append(site_match.group(1))
            clean_query = re.sub(r"\bsite:[A-Za-z0-9.-]+", "", query).strip()

        payload: Dict[str, Any] = {
            "api_key": self.api_key,
            "query": clean_query,
            "max_results": count,
            "search_depth": "basic",
        }
        if include_domains:
            payload["include_domains"] = include_domains

        req = urllib.request.Request(
            "https://api.tavily.com/search",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        results = []
        for idx, item in enumerate(data.get("results", [])[:count]):
            results.append(
                SearchResult(
                    url=item.get("url", ""),
                    title=item.get("title", ""),
                    snippet=item.get("content", ""),
                    rank=idx + 1,
                    provider=self.name,
                    published_date=item.get("published_date"),
                )
            )
        return results

def get_provider(name: str, fixture_path: Optional[str] = None) -> SearchProvider:
    name_clean = name.lower()
    if name_clean == "fixture":
        if not fixture_path:
            raise ValueError("Fixture provider requires fixture_path")
        return FixtureProvider(fixture_path)
    elif name_clean == "brave":
        return BraveProvider()
    elif name_clean == "tavily":
        return TavilyProvider()
    else:
        raise ValueError(f"Unknown provider '{name}'")
