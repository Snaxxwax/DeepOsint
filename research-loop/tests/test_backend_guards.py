import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from rloop.http import public_target, fetch_url, request_public
from rloop.spec import validate_spec_data
from rloop.store import Store
from rloop.loop import ResearchLoop
from rloop.providers import FixtureProvider


class BackendGuards(unittest.TestCase):
    def test_block_private_dns_before_fetch(self):
        with patch('rloop.http.socket.getaddrinfo', return_value=[(2,1,6,'',('127.0.0.1',80))]):
            with self.assertRaises(ValueError):
                public_target('http://attacker.example/path')
            self.assertEqual(fetch_url('http://attacker.example/path')[0],403)

    def test_block_mixed_dns_answers(self):
        with patch('rloop.http.socket.getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',80)),(2,1,6,'',('10.0.0.1',80))]):
            with self.assertRaises(ValueError):
                public_target('https://attacker.example')

    def test_public_address_is_pinned(self):
        with patch('rloop.http.socket.getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',443))]):
            self.assertEqual(public_target('https://example.org')[2],'8.8.8.8')

    def test_reject_protocol_credentials_and_ports(self):
        for url in ['file:///etc/passwd','http://user:pass@example.org','http://example.org:8080','http://hidden.onion','http://home.local']:
            with self.assertRaises(ValueError):
                public_target(url)

    def test_redirect_to_private_target_is_rejected(self):
        with patch('rloop.http.public_target', side_effect=[(__import__('urllib.parse',fromlist=['urlparse']).urlparse('https://example.org'),443,'8.8.8.8'),ValueError('blocked')]), patch('rloop.http.PinnedHTTPS') as conn:
            response=conn.return_value.getresponse.return_value
            response.status=302;response.getheader.return_value='http://127.0.0.1/'
            with self.assertRaises(ValueError):
                request_public('https://example.org','TestBot')

    def test_spec_rejects_unbounded_or_duplicate_work(self):
        spec=json.loads((Path(__file__).parent.parent/'examples/fed_chair.spec.json').read_text())
        for change in [{'max_rounds':100000},{'slots':[spec['slots'][0],spec['slots'][0]]},{'results_per_query':1000},{'primary_domains':'example.org'}]:
            data=copy.deepcopy(spec);data.update(change)
            with self.assertRaises(ValueError):
                validate_spec_data(data)

    def test_completed_run_resume_returns_without_reprocessing(self):
        spec=validate_spec_data(json.loads((Path(__file__).parent.parent/'examples/fed_chair.spec.json').read_text()))
        with tempfile.TemporaryDirectory() as directory:
            store=Store(str(Path(directory)/'state.sqlite'))
            store.create_run('complete',json.dumps(spec.to_dict()),'fixture')
            store.update_run_stage('complete',3,'completed',stop_reason='already done')
            result=ResearchLoop(spec,store,FixtureProvider({})).run('complete')
            self.assertEqual(result['stop_reason'],'already done')
            self.assertEqual(result['rounds'],3)
            store.close()
