# Liste les appels d'outils d'une mission (nom, arguments courts, issue ; URL et e-mails masqués) : python3 -I .manager/outils/appels-mission.py <port> <id> [filtre]
import json, re, sys, urllib.request
port, rid = sys.argv[1], sys.argv[2]; flt = sys.argv[3] if len(sys.argv) > 3 else ''
H = {'x-platform-request': '1'}
def mask(s):
    s = re.sub(r'https?://(?!127\.0\.0\.1)[^\s"<>)\]]+', '<url>', str(s)); return re.sub(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', '<mail>', s)
calls = {}
req = urllib.request.Request(f'http://127.0.0.1:{port}/api/runs/{rid}/events?after=0', headers=H)
try:
    with urllib.request.urlopen(req, timeout=8) as resp:
        for raw in resp:
            l = raw.decode('utf-8', 'replace')
            if not l.startswith('data:'): continue
            try: e = json.loads(l[5:])
            except Exception: continue
            d = e.get('data') or {}; u = d.get('update', d)
            su = u.get('sessionUpdate')
            if su in ('tool_call', 'tool_call_update'):
                c = calls.setdefault(u.get('toolCallId'), {'title': '', 'status': '', 'raw': '', 'out': ''})
                c['title'] = u.get('title') or c['title']
                c['status'] = u.get('status') or c['status']
                if u.get('rawInput'): c['raw'] = json.dumps(u.get('rawInput'), ensure_ascii=False)[:200]
                if u.get('content'): c['out'] = json.dumps(u.get('content'), ensure_ascii=False)[:300]
except Exception as ex:
    pass
for k, c in calls.items():
    line = f"{c['status']:10} {c['title'][:60]} {c['raw']}"
    if flt in line:
        print(mask(line)); 
        if c['status'] == 'failed': print('   →', mask(c['out'])[:300])
