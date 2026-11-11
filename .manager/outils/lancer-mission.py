# Lance une mission et affiche son identifiant :
#   python3 -I .manager/outils/lancer-mission.py <port> <agent> <modèle|-> <navigateur> <pack> "<prompt>" [pièce jointe]
import json, sys, urllib.request

port, agent, model, browser, pack, prompt = sys.argv[1:7]
API = f'http://127.0.0.1:{port}'
H = {'content-type': 'application/json', 'x-platform-request': '1'}
body = {'prompt': prompt, 'agent': agent, 'browser': browser, 'pack': pack}
if model != '-':
    body['model'] = model
if pack == 'career-ops':
    body['workspace'] = 'career-ops'
if len(sys.argv) > 7:
    path = sys.argv[7]
    req = urllib.request.Request(
        API + '/api/files',
        method='POST',
        headers={'x-platform-request': '1', 'x-file-name': path.split('/')[-1], 'content-type': 'application/pdf'},
        data=open(path, 'rb').read(),
    )
    body['attachments'] = [json.loads(urllib.request.urlopen(req, timeout=30).read())['id']]
req = urllib.request.Request(API + '/api/runs', method='POST', headers=H, data=json.dumps(body).encode())
run = json.loads(urllib.request.urlopen(req, timeout=30).read())
print(run.get('id') or run['run']['id'])
