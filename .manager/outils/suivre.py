import json, sys, time, urllib.request, re
API='http://127.0.0.1:4310'; H={'x-platform-request':'1'}
rid=sys.argv[1]; budget=int(sys.argv[2]) if len(sys.argv)>2 else 240
def get(p):
    with urllib.request.urlopen(urllib.request.Request(API+p,headers=H),timeout=20) as r: return json.loads(r.read())
def host(u):
    try:
        x=urllib.parse.urlsplit(u); return x.netloc+re.sub(r'\d{5,}','<n>',x.path)[:40]
    except Exception: return '?'
import urllib.parse
r=get(f'/api/runs/{rid}'); print('mission',r['id'][:8],'agent',r.get('agent'),r.get('model'),'navigateur',r.get('browser'),'état',r['state'])
seen=0; last=None; t0=time.time()
while True:
    r=get(f'/api/runs/{rid}')
    ev=get(f'/api/runs/{rid}/events') if False else None
    st=r['state']
    if st!=last: print(f"t+{int(time.time()-t0):3d}s état={st}"); last=st
    if st in ('waiting_permission','awaiting_owner'):
        p=r.get('pendingPermission'); q=r.get('pendingQuestion')
        if p: print('pendingPermission:',json.dumps({k:p.get(k) for k in ('id','capability','actionClass','askedAt')},ensure_ascii=False),'| aperçu:',str(p.get('preview'))[:300])
        if q: print('pendingQuestion (tronquée):',json.dumps(q,ensure_ascii=False)[:600])
        break
    if st in ('completed','failed','cancelled','interrupted'):
        s=str((r.get('result') or {}).get('summary') or ''); print('--- résumé (hôtes masqués, 1200 car.) ---'); print(re.sub(r'https?://\S+',lambda m:'<'+host(m.group(0))+'>',s)[:1200]); break
    if time.time()-t0>budget: print('(budget de suivi écoulé, mission toujours',st,')'); break
    time.sleep(5)
