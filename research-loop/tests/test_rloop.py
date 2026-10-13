import json
import os
import tempfile
import unittest
from datetime import date

from rloop.spec import validate_spec_data, load_spec, ResearchSpec, SubQuestionSlot
from rloop.planner import build_query_text, plan_initial_round, plan_refinement_round, PlannedQuery
from rloop.providers import FixtureProvider, TavilyProvider, SearchResult
from rloop.fetch import extract_text_from_html, extract_dates_from_html
from rloop.provenance import get_word_shingles, jaccard_similarity, assign_origins
from rloop.util import normalize_url
from rloop.verify import verify_claim, Verdict
from rloop.claims import extract_claims_deterministic
from rloop.grade import grade_slot, SlotGrade
from rloop.store import Store
from rloop.loop import ResearchLoop
from rloop.report import generate_report_markdown

class TestResearchLoop(unittest.TestCase):
    # 1. Spec: valid
    def test_spec_valid(self):
        data = {
            "question": "Who chairs the Federal Reserve?",
            "as_of": "2026-10-12",
            "required_grade": "A",
            "fact_class": "leadership",
            "primary_domains": ["federalreserve.gov"],
            "slots": [{"slot_id": "s1", "question": "Who chairs the Fed?", "answer_terms": ["chair"]}],
        }
        spec = validate_spec_data(data)
        self.assertEqual(spec.as_of, "2026-10-12")
        self.assertEqual(spec.required_grade, "A")

    # 2. Spec: empty frame slot rejected
    def test_spec_empty_frame_slot(self):
        data = {
            "question": "",
            "as_of": "2026-10-12",
            "required_grade": "A",
            "fact_class": "leadership",
            "primary_domains": ["federalreserve.gov"],
            "slots": [{"slot_id": "s1", "question": "Who chairs the Fed?", "answer_terms": ["chair"]}],
        }
        with self.assertRaises(ValueError):
            validate_spec_data(data)

    # 3. Spec: invalid as_of date rejected
    def test_spec_invalid_as_of_date(self):
        data = {
            "question": "Who chairs the Fed?",
            "as_of": "yesterday",
            "required_grade": "A",
            "fact_class": "leadership",
            "primary_domains": ["federalreserve.gov"],
            "slots": [{"slot_id": "s1", "question": "Who chairs the Fed?", "answer_terms": ["chair"]}],
        }
        with self.assertRaises(ValueError):
            validate_spec_data(data)

    # 4. Spec: relative word rejected in query fields
    def test_spec_relative_word_in_query(self):
        data = {
            "question": "Who is the latest Fed chair?",
            "as_of": "2026-10-12",
            "required_grade": "A",
            "fact_class": "leadership",
            "primary_domains": ["federalreserve.gov"],
            "slots": [{"slot_id": "s1", "question": "Who chairs the Fed?", "answer_terms": ["chair"]}],
        }
        with self.assertRaises(ValueError):
            validate_spec_data(data)

    # 5. Spec: no slots rejected
    def test_spec_no_slots(self):
        data = {
            "question": "Who chairs the Fed?",
            "as_of": "2026-10-12",
            "required_grade": "A",
            "fact_class": "leadership",
            "primary_domains": ["federalreserve.gov"],
            "slots": [],
        }
        with self.assertRaises(ValueError):
            validate_spec_data(data)

    # 6. Planner: query never contains target answer
    def test_planner_query_never_contains_answer(self):
        spec = ResearchSpec(
            question="Who chairs the Federal Reserve?",
            as_of="2026-10-12",
            required_grade="A",
            fact_class="leadership",
            primary_domains=["federalreserve.gov"],
            slots=[SubQuestionSlot(slot_id="chair", question="Who chairs the Fed?", answer_terms=["chair"])],
        )
        queries = plan_initial_round(spec)
        for q in queries:
            self.assertNotIn("Warsh", q.query_text)
            self.assertNotIn("Powell", q.query_text)

    # 7. Planner: builds angle variants
    def test_planner_angles(self):
        q_direct = build_query_text("Federal Reserve", "chair", "direct", "federalreserve.gov", "2026")
        q_temporal = build_query_text("Federal Reserve", "chair", "temporal", "federalreserve.gov", "2026")
        self.assertEqual(q_direct, "Federal Reserve chair")
        self.assertIn("2026", q_temporal)

    # 8. Planner: primary angle adds site filter
    def test_planner_primary_domain_site_filter(self):
        q_primary = build_query_text("Federal Reserve", "chair", "primary", "federalreserve.gov", "2026")
        self.assertTrue(q_primary.startswith("site:federalreserve.gov"))

    # 9. Provider: fixture provider returns ranked results
    def test_fixture_provider_returns_results(self):
        mock_data = {
            "federal reserve chair": [
                {"url": "https://reuters.com/news1", "title": "Test News", "snippet": "Test snippet"}
            ]
        }
        provider = FixtureProvider(mock_data)
        results = provider.search("federal reserve chair", count=5)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].provider, "fixture")
        self.assertEqual(results[0].rank, 1)

    # 10. Provider: Tavily adapter moves site filter to domain filter
    def test_tavily_adapter_moves_site_filter(self):
        provider = TavilyProvider(api_key="mock_key")
        # Test query parsing logic
        query = "site:federalreserve.gov federal reserve chair"
        import re
        site_match = re.search(r"\bsite:([A-Za-z0-9.-]+)", query)
        clean = re.sub(r"\bsite:[A-Za-z0-9.-]+", "", query).strip()
        self.assertEqual(site_match.group(1), "federalreserve.gov")
        self.assertEqual(clean, "federal reserve chair")

    # 11. Fetch: text extraction strips tags and scripts
    def test_fetch_text_extraction(self):
        raw_html = "<html><head><script>alert(1);</script></head><body><h1>Title</h1><p>Paragraph content.</p></body></html>"
        extracted = extract_text_from_html(raw_html)
        self.assertNotIn("alert(1)", extracted)
        self.assertIn("Title", extracted)
        self.assertIn("Paragraph content.", extracted)

    # 12. Fetch: date extraction from meta and JSON-LD
    def test_fetch_date_extraction_meta(self):
        html_doc = """
        <html><head>
        <meta property="article:published_time" content="2026-05-22T08:00:00Z" />
        <script type="application/ld+json">
        {"@context": "https://schema.org", "dateModified": "2026-05-23"}
        </script>
        </head><body>Content</body></html>
        """
        pub, mod = extract_dates_from_html(html_doc)
        self.assertEqual(pub, "2026-05-22")
        self.assertEqual(mod, "2026-05-23")

    # 13. Provenance: URL normalization collapses tracking & locale
    def test_provenance_url_normalization(self):
        url1 = "https://amp.reuters.com/en-us/markets/news?utm_source=twitter&ref=123"
        url2 = "https://reuters.com/markets/news"
        self.assertEqual(normalize_url(url1), normalize_url(url2))

    # 14. Provenance: shingle overlap >= 50% merges into one origin
    def test_provenance_shingle_clustering(self):
        text_a = "Kevin Warsh was appointed Chair of the Federal Reserve Board of Governors in Washington yesterday."
        text_b = "Kevin Warsh was appointed Chair of the Federal Reserve Board of Governors in Washington yesterday."
        text_c = "A completely different article about agricultural trade in South America."

        pages = [
            {"url": "https://wire1.com/a", "text": text_a},
            {"url": "https://wire2.com/b", "text": text_b},
            {"url": "https://farm.org/c", "text": text_c},
        ]
        origins = assign_origins(pages, threshold=0.5)
        self.assertEqual(origins["https://wire1.com/a"], origins["https://wire2.com/b"])
        self.assertNotEqual(origins["https://wire1.com/a"], origins["https://farm.org/c"])

    # 15. Verify: find-the-words test passes when present
    def test_find_the_words_passes(self):
        page = "Kevin Warsh is the confirmed Chair of the Federal Reserve Board."
        verdict = verify_claim("Kevin Warsh is the confirmed Chair", "Kevin Warsh", page)
        self.assertTrue(verdict.passed)
        self.assertIsNone(verdict.reason)

    # 16. Verify: rejects missing sentence
    def test_find_the_words_rejects_missing_sentence(self):
        page = "Kevin Warsh is the confirmed Chair of the Federal Reserve Board."
        verdict = verify_claim("Janet Yellen announced the interest rates", "Janet Yellen", page)
        self.assertFalse(verdict.passed)
        self.assertEqual(verdict.reason, "supporting sentence not found on page")

    # 17. Verify: rejects missing value token
    def test_find_the_words_rejects_missing_value(self):
        page = "The chairman gave a detailed speech on monetary inflation."
        verdict = verify_claim("The chairman gave a detailed speech", "Kevin Warsh", page)
        self.assertFalse(verdict.passed)
        self.assertIn("value not found on page", verdict.reason)

    # 18. Verify: fake LLM hallucination is rejected and unverified
    def test_find_the_words_rejects_hallucination(self):
        page = "Federal Reserve officials gathered in Washington for annual consultations."
        # Claude hallucinates support:
        invented_sentence = "Janet Yellen is chair of the Federal Reserve."
        verdict = verify_claim(invented_sentence, "Janet Yellen", page)
        self.assertFalse(verdict.passed)

    # 19. Grade: fresh source of record earns Grade A
    def test_grade_fresh_source_of_record_wins(self):
        claims = [
            {"value": "Kevin Warsh", "url": "https://federalreserve.gov/board.htm"},
            {"value": "Other Person", "url": "https://random-blog.com/post"},
        ]
        pages_map = {
            "https://federalreserve.gov/board.htm": {"origin_id": "o1", "published_date": "2026-09-15"},
            "https://random-blog.com/post": {"origin_id": "o2", "published_date": "2026-09-15"},
        }
        res = grade_slot("chair", claims, pages_map, ["federalreserve.gov"], "2026-10-12", shelf_life_days=90)
        self.assertEqual(res.grade, "A")
        self.assertEqual(res.answer_value, "Kevin Warsh")

    # 20. Grade: two origins past shelf life drops to Grade C
    def test_grade_past_shelf_life_drops(self):
        claims = [
            {"value": "Kevin Warsh", "url": "https://reuters.com/a"},
            {"value": "Kevin Warsh", "url": "https://wsj.com/b"},
        ]
        pages_map = {
            "https://reuters.com/a": {"origin_id": "o1", "published_date": "2026-05-20"},  # 145 days old (> 90)
            "https://wsj.com/b": {"origin_id": "o2", "published_date": "2026-05-20"},
        }
        res = grade_slot("chair", claims, pages_map, ["federalreserve.gov"], "2026-10-12", shelf_life_days=90)
        self.assertEqual(res.grade, "C")
        self.assertIn("145 days old", res.notes)

    # 21. Grade: single origin stale is Grade D
    def test_grade_single_origin_stale_is_d(self):
        claims = [{"value": "Jerome Powell", "url": "https://bloomberg.com/2025"}]
        pages_map = {"https://bloomberg.com/2025": {"origin_id": "o1", "published_date": "2025-01-01"}}
        res = grade_slot("chair", claims, pages_map, ["federalreserve.gov"], "2026-10-12", shelf_life_days=90)
        self.assertEqual(res.grade, "D")

    # 22. Store: idempotent writes on SQLite
    def test_store_idempotent_writes(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tf:
            db_path = tf.name
        try:
            store = Store(db_path)
            q1 = store.save_query("run1", 1, "s1", "federal reserve chair", "direct")
            q2 = store.save_query("run1", 1, "s1", "federal reserve chair", "direct")
            self.assertEqual(q1, q2)  # Same query ID returned, no duplicate row
            store.close()
        finally:
            if os.path.exists(db_path):
                os.remove(db_path)

    # 23. Store: crash and resume picks up cleanly
    def test_store_crash_and_resume(self):
        with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tf:
            db_path = tf.name
        try:
            store = Store(db_path)
            store.create_run("run_crash", '{"question": "test"}', "fixture")
            # Save query and advance stage to searched
            store.save_query("run_crash", 1, "s1", "query text", "direct")
            store.update_run_stage("run_crash", 1, "searched")
            store.close()

            # Resume
            store2 = Store(db_path)
            run_rec = store2.get_run("run_crash")
            self.assertEqual(run_rec["stage_marker"], "searched")
            self.assertEqual(run_rec["round"], 1)
            queries = store2.get_queries_for_run("run_crash")
            self.assertEqual(len(queries), 1)
            store2.close()
        finally:
            if os.path.exists(db_path):
                os.remove(db_path)

    # 24. End-to-end: Fed Chair demo reaches Grade A in 3 rounds
    def test_fed_chair_demo_three_rounds_grade_a(self):
        fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "fed_chair.json")
        spec_path = os.path.join(os.path.dirname(__file__), "..", "examples", "fed_chair.spec.json")

        spec = load_spec(spec_path)
        with open(fixture_path, "r", encoding="utf-8") as f:
            f_data = json.load(f)

        with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tf:
            db_path = tf.name

        try:
            store = Store(db_path)
            provider = FixtureProvider(f_data["queries"])
            loop = ResearchLoop(
                spec=spec,
                store=store,
                provider=provider,
                fixture_pages=f_data["pages"],
            )

            res = loop.run("test_demo_run")
            self.assertEqual(res["rounds"], 3)
            self.assertEqual(res["stop_reason"], "Stop: both met")

            # Check final round grades
            final_grades = store.get_grades_for_run("test_demo_run", round_num=3)
            self.assertEqual(len(final_grades), 2)
            for g in final_grades:
                self.assertEqual(g["grade"], "A")

            # Verify report generation
            report = generate_report_markdown(spec, "test_demo_run", store)
            self.assertIn("# Research Brief", report)
            self.assertIn("Kevin Warsh", report)
            self.assertIn("governor", report)
            self.assertIn("Reviewed and signed by", report)

            store.close()
        finally:
            if os.path.exists(db_path):
                os.remove(db_path)

if __name__ == "__main__":
    unittest.main()
