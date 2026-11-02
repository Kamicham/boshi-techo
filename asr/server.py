"""健診の録音を文字にする小さなサーバ（自宅PCの GPU で動かす）。

POST /transcribe に音声のバイト列を送ると、{"text": ..., "segments": [...]} を返す。
音声はメモリと一時ファイルにだけ置き、文字にしたらすぐ消す（家の外に出さない）。
"""
import json, os, sys, tempfile, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from faster_whisper import WhisperModel

MODEL = os.environ.get("ASR_MODEL", "large-v3")
HOST = os.environ.get("ASR_HOST", "127.0.0.1")
PORT = int(os.environ.get("ASR_PORT", "8765"))

print(f"loading {MODEL} ...", flush=True)
model = WhisperModel(MODEL, device="cuda", compute_type="float16")
print("ready", flush=True)


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self._json(200, {"ok": True, "model": MODEL})

    def do_POST(self):
        if self.path != "/transcribe":
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("content-length", "0"))
        data = self.rfile.read(n)
        prompt = self.headers.get("x-prompt") or None
        if prompt:
            prompt = bytes.fromhex(prompt).decode("utf-8")
        t0 = time.time()
        with tempfile.NamedTemporaryFile(suffix=".audio") as f:
            f.write(data)
            f.flush()
            segs, info = model.transcribe(
                f.name, language="ja", vad_filter=True, beam_size=5, initial_prompt=prompt
            )
            out = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segs]
        self._json(200, {
            "text": "".join(s["text"] for s in out),
            "segments": out,
            "duration": round(info.duration, 1),
            "elapsed": round(time.time() - t0, 1),
        })

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


ThreadingHTTPServer((HOST, PORT), H).serve_forever()
