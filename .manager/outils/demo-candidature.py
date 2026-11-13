# Démonstration de bout en bout sur la page de candidature FICTIVE locale (tests/support/apply-page.js).
# Lance une mission, répond aux questions de l'agent par la première option qui contient un des mots
# donnés (sinon la première option), et n'accorde une carte d'envoi QUE si sa cible est 127.0.0.1 :
# toute autre carte est laissée en attente et le script s'arrête. Affiche le Bilan final.
#
#   python3 -I .manager/outils/demo-candidature.py <port> skill|libre [délai_s]
#   python3 -I .manager/outils/demo-candidature.py <port> libre-cv <délai_s> <cv.pdf>   (sans Skill, CV joint)
#   python3 -I .manager/outils/demo-candidature.py <port> deux [délai_s]   (deux candidatures d'affilée)
# Variables facultatives : DEMO_BROWSER (isolated par défaut ; playwriter = Chrome du propriétaire par le
# relais), DEMO_AGENT (claude), DEMO_MODEL (sonnet ; vide pour le modèle par défaut de l'agent), DEMO_PROMPT.
# DEMO_GRANT=1 (accord-mission-01) : la PREMIÈRE carte d'envoi, si et seulement si sa cible est 127.0.0.1,
# reçoit « Autoriser tous les envois de cette mission » (allow_mission) ; le script ne doit plus voir de
# carte ensuite : toute carte suivante est laissée en attente et le script s'arrête. Le mode `deux` passe
# par le pack career-ops (seul pack qui déclare sendGrant ; sans lui l'option n'est pas proposée).
import json, os, sys, time, urllib.request

port = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else 'skill'
limit = float(sys.argv[3]) if len(sys.argv) > 3 else 900
API = f'http://127.0.0.1:{port}'
H = {'content-type': 'application/json', 'x-platform-request': '1'}
PREFER = ['oui', 'envoyer', 'malgré', 'postuler', 'applied', 'complète', 'continuer', 'yes']
PROMPTS = {
    'skill': "Postule à l'offre du rapport 005 (Preacta) via le formulaire de candidature FICTIF "
    "http://127.0.0.1:4321/ : remplis les trois étapes avec mon profil, joins mon CV adapté à cette "
    "offre, réponds aux questions, puis clique sur Envoyer.",
    'libre': "Candidate à l'offre sur le formulaire de candidature FICTIF http://127.0.0.1:4321/ avec "
    "ces informations : nom Alex Martin, e-mail alex.martin@example.test, téléphone 0400 000 000, "
    "disponibilité immédiate, motivation : deux phrases sur mon intérêt pour un poste d'ingénieur IA. "
    "Pas de CV à joindre. Va jusqu'au bout et clique sur Envoyer.",
}
PROMPTS['deux'] = (
    "Fais deux candidatures FICTIVES d'affilée sur le formulaire FICTIF http://127.0.0.1:4321/, dans "
    "cette même mission. Première : nom Alex Martin, e-mail alex.martin@example.test, téléphone "
    "0400 000 000, disponibilité immédiate, motivation : deux phrases sur un poste d'ingénieur IA ; "
    "pas de CV ; va jusqu'au bout et clique sur Envoyer. Ensuite rouvre http://127.0.0.1:4321/ et fais "
    "la seconde : nom Sam Durand, e-mail sam.durand@example.test, téléphone 0400 000 001, "
    "disponibilité sous un mois, motivation : deux phrases sur un poste de data scientist ; pas de CV ; "
    "va jusqu'au bout et clique sur Envoyer."
)
PROMPTS['libre-cv'] = PROMPTS['libre'].replace(
    'Pas de CV à joindre.', 'Joins le CV fourni en pièce jointe.'
)


def call(path, body=None):
    req = urllib.request.Request(
        API + path,
        method='POST' if body is not None else 'GET',
        headers=H,
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


body = {
    'prompt': os.environ.get('DEMO_PROMPT') or PROMPTS[mode],
    'agent': os.environ.get('DEMO_AGENT', 'claude'),
    'model': os.environ.get('DEMO_MODEL', 'sonnet'),
    'browser': os.environ.get('DEMO_BROWSER', 'isolated'),
}
if mode == 'libre-cv':
    cv = sys.argv[4]
    req = urllib.request.Request(
        API + '/api/files',
        method='POST',
        headers={'x-platform-request': '1', 'x-file-name': cv.split('/')[-1], 'content-type': 'application/pdf'},
        data=open(cv, 'rb').read(),
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        body['attachments'] = [json.loads(r.read())['id']]
body.update(
    {'pack': 'career-ops', 'workspace': 'career-ops'} if mode in ('skill', 'deux') else {'pack': 'core'}
)
grant = os.environ.get('DEMO_GRANT') == '1'
cards = 0
run = call('/api/runs', body)
rid = run.get('id') or run['run']['id']
print('mission', rid, time.strftime('%H:%M:%S'))
t0 = time.time()
while time.time() - t0 < limit:
    r = call(f'/api/runs/{rid}')
    q, p = r.get('pendingQuestion'), r.get('pendingPermission')
    if q:
        props = q['requestedSchema']['properties']
        key = next(iter(props))
        options = [o.get('const') for o in props[key].get('oneOf', [])]
        pick = next((o for w in PREFER for o in options if o and w in o.lower()), options[0] if options else 'oui')
        print(time.strftime('%H:%M:%S'), 'question :', q['message'][:200], '→', pick)
        call(f'/api/runs/{rid}/answer', {'action': 'accept', 'content': {key: pick}})
    elif p:
        preview = p.get('preview') or ''
        if '127.0.0.1:' not in preview:
            print('carte NON fictive laissée en attente :', preview[:200])
            break
        cards += 1
        if grant and cards > 1:
            print('carte inattendue après l’accord de mission, laissée en attente :', preview[:200])
            break
        option = 'allow_mission' if grant else 'allow'
        label = 'carte accordée (FICTIF, accord de mission) :' if grant else 'carte accordée (FICTIF) :'
        print(time.strftime('%H:%M:%S'), label, preview[:160])
        call(f"/api/permissions/{p['id']}", {'optionId': option})
    elif r.get('state') in ('completed', 'failed', 'cancelled', 'interrupted'):
        summary = (r.get('result') or {}).get('summary') or r.get('error') or ''
        print(time.strftime('%H:%M:%S'), 'état final :', r['state'], f'({int(time.time() - t0)} s)')
        i = summary.find('Bilan')
        print(summary[i:] if i >= 0 else summary[-1500:])
        break
    time.sleep(5)
else:
    print('délai atteint')
