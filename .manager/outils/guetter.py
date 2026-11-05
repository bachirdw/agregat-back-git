import json, sys, time, urllib.request, re, subprocess
API='http://127.0.0.1:4310'; H={'x-platform-request':'1'}
def get(p):
    with urllib.request.urlopen(urllib.request.Request(API+p,headers=H),timeout=20) as r: return json.loads(r.read())
known={r['id'] for r in get('/api/runs')}
t0=time.time(); budget=int(sys.argv[1]) if len(sys.argv)>1 else 1800
while time.time()-t0<budget:
    new=[r for r in get('/api/runs') if r['id'] not in known]
    if new:
        r=sorted(new,key=lambda r:r.get('createdAt',''))[0]
        print('nouvelle mission',r['id'],r.get('createdAt'),r.get('model'),'|',re.sub(r'https?://\S+','<url>',str(r.get('prompt')))[:160]); sys.stdout.flush()
        open(sys.argv[2],'w').write(r['id'])
        subprocess.run([sys.executable,'-I',__import__('os').path.join(__import__('os').path.dirname(__file__),'suivre.py'),r['id'],str(int(budget-(time.time()-t0)))])
        break
    time.sleep(5)
else: print('aucune mission nouvelle dans le budget')
