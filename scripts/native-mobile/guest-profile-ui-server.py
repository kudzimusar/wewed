"""Loopback-only synthetic guest API for native UI qualification; no database access."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from urllib.parse import unquote
from pathlib import Path
PASS = json.loads((Path(__file__).resolve().parents[2] / "mobile/fixtures/guest-profile-ww2.json").read_text())

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or '{}')
        status = body.get('token', 'pending')
        self.respond(status, issue=True)
    def do_GET(self):
        cookie = self.headers.get('Cookie', '')
        status = next((v for v in ['attending', 'declined', 'pending'] if 'ui-session-'+v in cookie), 'pending')
        self.respond(status)
    def respond(self, status, issue=False):
        self.path = unquote(self.path)
        data = {'success': True, 'authorized': True, 'wedding': {'slug': 'guest-ui', 'title': 'Alex & Sam', 'date': '2027-06-12', 'venue': 'Test Venue', 'invitationCardStyle': 'ivory-floral-gold'}, 'guest': {'id': 'ui-guest-a', 'name': 'UI Guest A', 'tableName': 'Acacia'}, 'rsvp': {'attending': {'attending': True, 'declined': False}.get(status), 'plusOne': False, 'kidsAttending': False, 'kidsCount': 0, 'checkedIn': False}}
        if self.path == '/api/wedding-day/pass':
            if status != 'attending': self.send_error(409); return
            data = {'success': True, 'data': PASS}
        elif self.path == '/api/wedding-day/guest':
            if status != 'attending': self.send_error(409); return
            data = {'success': True, 'data': {'guest': {'id': 'ui-guest-a', 'tableNumber': 1, 'tableName': 'Acacia', 'checkedIn': False, 'household': [{'attendeeKey': 'primary', 'attendeeName': 'UI Guest A'}]}, 'programme': [{'id': 'ceremony', 'time': '14:00', 'title': 'Synthetic ceremony'}], 'announcements': [{'id': 'welcome', 'title': 'Welcome', 'body': 'Synthetic guest announcement'}]}}
        elif not self.path.startswith('/api/weddings/guest-ui/guest-session'):
            self.send_error(404); return
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        if issue: self.send_header('Set-Cookie', 'wewed_wedding_guest=ui-session-'+status+'; Path=/; HttpOnly')
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__': ThreadingHTTPServer(('127.0.0.1', 8768), Handler).serve_forever()
