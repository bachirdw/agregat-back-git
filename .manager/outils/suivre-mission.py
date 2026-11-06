# Suit une mission jusqu'à une carte d'accord, une question ou un état final : python3 -I .manager/outils/suivre-mission.py <port> <id> [max_s]
import json, re, sys, time, urllib.request
port, rid = sys.argv[1], sys.argv[2]; limit = float(sys.argv[3]) if len(sys.argv) > 3 else 280
H = {'x-platform-request': '1'}
def mask(s):
    s = re.sub(r'https?://(?!127\.0\.0\.1)[^\s"<>)\]]+', '<url>', str(s)); return re.sub(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', '<mail>', s)
t0 = time.time(); last = None
while True:
    r = json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/api/runs/{rid}', headers=H), timeout=20).read())
    sp = r.get('skillProgress') or {}
    steps = ' '.join(f"{s.get('id')}:{s.get('state')[0]}" for s in sp.get('steps') or [])
    calls = [s.get('tool') or s.get('name') or s.get('title') for s in (r.get('steps') or [])][-4:]
    line = f"{time.strftime('%H:%M:%S')} {r.get('state')} | {steps} | {calls}"
    if line[9:] != last: print(mask(line)); last = line[9:]
    pp, pq = r.get('pendingPermission'), (r.get('pendingQuestion') if 'pendingQuestion' in r else None)
    if pp or r.get('state') in ('completed', 'failed', 'cancelled', 'awaiting_owner', 'waiting_permission'):
        print('pending:', mask(json.dumps(pp, ensure_ascii=False))[:900]); break
    if time.time() - t0 > limit: print('délai de suivi atteint'); break
    time.sleep(10)
