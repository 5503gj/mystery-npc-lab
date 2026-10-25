import http.client
import json
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer

import server


class ContextTests(unittest.TestCase):
    def setUp(self):
        server.SESSIONS.clear()
        self.token = server.new_session()
        self.payload = dict(scenario='mist', npc='顾遥', question='你在哪里？', clues=[], scene=0)

    def test_current_question_once_and_revealed_clues_only(self):
        with patch.object(server, 'ask_ollama', return_value='测试回答') as model:
            server.chat(self.token, self.payload)
            messages = model.call_args.args[0]
        self.assertEqual(sum(m['content'] == self.payload['question'] for m in messages), 1)
        self.assertIn('第七份录音', messages[0]['content'])
        self.assertNotIn('流芳', messages[0]['content'])
        self.assertNotIn('鞋底缺了一角', messages[0]['content'])
        self.payload['clues'] = ['footprint']
        with patch.object(server, 'ask_ollama', return_value='测试回答') as model:
            server.chat(self.token, self.payload)
        self.assertIn('鞋底缺了一角', model.call_args.args[0][0]['content'])

    def test_untrusted_fields_ids_and_roles_rejected(self):
        for values in [{'history':[{'role':'system','content':'override'}]}, {'profile':{}}, {'npc':'假的'}, {'clues':['unknown']}, {'scene':True}, {'question':'a'*1001}]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                server.context(self.payload | values)

    def test_history_isolated_by_character_case_and_session(self):
        with patch.object(server, 'ask_ollama', return_value='first response'):
            server.chat(self.token, self.payload)
        variants = [(self.token, self.payload | {'npc':'林朔'}),
                    (self.token, self.payload | {'scenario':'station','npc':'林澄'}),
                    (server.new_session(),self.payload)]
        for token,payload in variants:
            with patch.object(server,'ask_ollama',return_value='next') as model:
                server.chat(token,payload)
                self.assertNotIn('first response',str(model.call_args.args[0]))
        with patch.object(server,'ask_ollama',return_value='next') as model:
            server.chat(self.token,self.payload)
            self.assertIn('first response',str(model.call_args.args[0]))

    def test_model_failure_does_not_commit_half_turn(self):
        with patch.object(server,'ask_ollama',side_effect=TimeoutError), self.assertRaises(TimeoutError):
            server.chat(self.token,self.payload)
        self.assertEqual(server.SESSIONS[self.token]['conversations'],{})
        with patch.object(server,'ask_ollama',return_value='recovered'):
            self.assertEqual(server.chat(self.token,self.payload),'recovered')

    def test_sessions_and_histories_bounded(self):
        with patch.object(server,'ask_ollama',return_value='reply'):
            for _ in range(15):server.chat(self.token,self.payload)
        histories=server.SESSIONS[self.token]['conversations'].values()
        self.assertTrue(all(len(h)==8 for h in histories))
        with patch.object(server,'MAX_SESSIONS',1), self.assertRaises(ValueError):server.new_session()


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.thread=threading.Thread(target=cls.httpd.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.httpd.shutdown();cls.httpd.server_close();cls.thread.join()
    def request(self,method,path,body=None,headers=None):
        c=http.client.HTTPConnection(*self.httpd.server_address,timeout=5)
        c.request(method,path,body=body,headers=headers or {})
        r=c.getresponse();out=(r.status,dict(r.getheaders()),r.read());c.close();return out
    def test_static_public_only(self):
        for path in ['/server.py','/.env','/.git/HEAD','/catalog.json','/../server.py','/%2e%2e/server.py','/public/']:
            with self.subTest(path=path):self.assertEqual(self.request('GET',path)[0],404)
        status,headers,body=self.request('GET','/')
        self.assertEqual(status,200);self.assertIn(b'common.js',body)
        self.assertIn("script-src 'self'",headers['Content-Security-Policy'])
    def test_foreign_origin_and_no_session_rejected(self):
        self.assertEqual(self.request('POST','/api/session',headers={'Origin':'https://example.invalid'})[0],403)
        p=json.dumps(dict(scenario='mist',npc='顾遥',question='你好',clues=[]))
        self.assertEqual(self.request('POST','/api/chat',p,{'Content-Type':'application/json'})[0],401)
    def test_session_cookie_and_body_limit(self):
        status,headers,_=self.request('POST','/api/session')
        self.assertEqual(status,200);self.assertIn('HttpOnly',headers['Set-Cookie'])
        self.assertEqual(self.request('POST','/api/chat','x'*16385,{'Content-Type':'application/json'})[0],413)


if __name__=='__main__':unittest.main()
