"""流芳互动网页的本地服务。

网页默认可以脱离模型运行：没有 Ollama 时使用关系规则兜底；
如果本机安装了 Ollama，则把当前场景与人物关系交给本地模型润色。
不读取、上传或公开剧本原文。
"""

import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = int(os.environ.get("MYSTERY_PORT", "7865"))
MODEL = os.environ.get("MYSTERY_MODEL", "qwen2.5:latest")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")


def ask_ollama(payload):
    profile = payload.get("profile") or {}
    npc_name = payload.get("npc", "NPC")
    listener = payload.get("listener", "玩家")
    relation = payload.get("relation", "")
    clues = payload.get("clues", [])
    history = payload.get("history", [])[-8:]
    question = payload.get("question", "")
    scene = payload.get("scene", {})
    system = f"""你是中文互动情感游戏《流芳》中的NPC：{npc_name}。
你必须始终保持人物身份、时代语感和已知信息边界，不得说自己是AI。
当前场景：{scene}
当前对话对象：{listener}
你与对方的关系规则：{relation}
人物资料（已做摘要）：{profile}
玩家已经公开的线索：{clues}
核心要求：同一个NPC面对不同对象必须切换语气和防备程度；关系规则优先于泛化性格。
尤其不要把陈明遇对陈稷的严厉，复制成他对芙蓉或阎应元的态度。
回答1-3句，优先回应玩家问题；不确定的事就含蓄回避，不凭空创造关系、经历或时间线。
只用原创的游戏化表达，不复述来源剧本长句，也不要主动泄露未公开的隐藏信息。"""
    messages = [{"role": "system", "content": system}]
    messages.extend(history)
    messages.append({"role": "user", "content": question})
    body = json.dumps(
        {
            "model": MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.55, "num_predict": 180},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        result = json.loads(response.read().decode("utf-8"))
    return result.get("message", {}).get("content", "").strip()


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/api/status":
            try:
                request = urllib.request.Request("http://127.0.0.1:11434/api/tags")
                with urllib.request.urlopen(request, timeout=2) as response:
                    tags = json.loads(response.read().decode("utf-8"))
                models = [item.get("name") for item in tags.get("models", [])]
                self.send_json(200, {"ok": True, "ollama": True, "model": MODEL, "models": models})
            except Exception:
                self.send_json(200, {"ok": True, "ollama": False, "model": MODEL, "models": []})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            answer = ask_ollama(payload)
            if not answer:
                raise RuntimeError("empty model response")
            self.send_json(200, {"ok": True, "answer": answer, "model": MODEL})
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError) as exc:
            self.send_json(200, {"ok": False, "error": f"local model unavailable: {exc}"})
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"流芳互动网页运行于 http://{HOST}:{PORT}/liufang.html")
    print(f"本地模型：{MODEL}（没有 Ollama 时网页自动使用关系规则）")
    server.serve_forever()
