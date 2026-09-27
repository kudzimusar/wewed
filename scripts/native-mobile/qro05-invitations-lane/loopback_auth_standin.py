"""Loopback stand-in for Supabase Auth's password grant ONLY (QRO05 local E2E).
Accepts exactly one synthetic account; everything else is 400. Never proxies anywhere."""
import base64, json, time
from http.server import BaseHTTPRequestHandler, HTTPServer

EMAIL, PASSWORD, UID = "qro05-planner@example.test", "qro05-local-only", "11111111-2222-3333-4444-555555555555"

def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=").decode()

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a): print("fake-auth", self.command, self.path.split("?")[0], flush=True)
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if self.path.startswith("/auth/v1/token") and body.get("email") == EMAIL and body.get("password") == PASSWORD:
            now = int(time.time())
            token = f'{b64({"alg":"HS256","typ":"JWT"})}.{b64({"sub":UID,"email":EMAIL,"exp":now+3600,"role":"authenticated","aud":"authenticated"})}.sig'
            payload = {"access_token": token, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
                       "refresh_token": "local", "user": {"id": UID, "email": EMAIL, "aud": "authenticated", "role": "authenticated",
                       "app_metadata": {}, "user_metadata": {}, "created_at": "2026-01-01T00:00:00Z"}}
            status = 200
        else:
            payload, status = {"error": "invalid_grant", "error_description": "Invalid login credentials"}, 400
        data = json.dumps(payload).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

HTTPServer(("127.0.0.1", 54399), H).serve_forever()
