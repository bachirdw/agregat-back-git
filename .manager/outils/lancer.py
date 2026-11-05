import json,sys,urllib.request
API='http://127.0.0.1:4310'; H={'content-type':'application/json','x-platform-request':'1'}
prompt=sys.argv[1]; model=sys.argv[2] if len(sys.argv)>2 else 'sonnet'
req=urllib.request.Request(API+'/api/runs',method='POST',headers=H,data=json.dumps({'prompt':prompt,'agent':'claude','pack':'career-ops','workspace':'career-ops','model':model,'browser':'playwriter'}).encode())
with urllib.request.urlopen(req,timeout=20) as r: run=json.loads(r.read())
rid=run.get('id') or run['run']['id']; print('mission', rid[:8]); open(sys.argv[3],'w').write(rid)
