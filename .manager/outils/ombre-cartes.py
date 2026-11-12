# carte-ombre-01 : lit la trace du mode d'observation de la carte d'envoi (AGENT_PLATFORM_CARD_SHADOW=1)
# d'une mission et affiche le tableau croisé « décision actuelle × R2 » puis les désaccords.
#
#   python3 -I .manager/outils/ombre-cartes.py <port|base> <mission>
#
# <port> : port de l'API (4313…) ; le dossier de données est celui du processus qui écoute sur ce port
#          (`lsof`, répertoire courant du processus + `.data`).
# <base> : un dossier : la racine d'un arbre (qui contient `.data`), le dossier de données lui-même, ou
#          directement le dossier `card-shadow`.
# La trace ne contient ni corps, ni valeur, ni chemin, ni requête : hôte, genre du clic, délai, raisons.
import json, os, subprocess, sys

if len(sys.argv) < 3:
    sys.exit('usage : ombre-cartes.py <port|base> <mission>')
where, mission = sys.argv[1], sys.argv[2]


def data_dir_of_port(port):
    pids = subprocess.run(['lsof', '-nP', f'-iTCP:{port}', '-sTCP:LISTEN', '-t'],
                          capture_output=True, text=True).stdout.split()
    if not pids:
        sys.exit(f'aucun processus à l’écoute sur le port {port}')
    out = subprocess.run(['lsof', '-a', '-p', pids[0], '-d', 'cwd', '-Fn'],
                         capture_output=True, text=True).stdout
    cwd = next((l[1:] for l in out.splitlines() if l.startswith('n')), None)
    if not cwd:
        sys.exit(f'répertoire du processus {pids[0]} introuvable')
    return os.path.join(cwd, '.data')


if where.isdigit():
    folder = os.path.join(data_dir_of_port(where), 'card-shadow')
else:
    base = os.path.abspath(os.path.expanduser(where))
    for candidate in (base, os.path.join(base, 'card-shadow'), os.path.join(base, '.data', 'card-shadow')):
        if os.path.basename(candidate) == 'card-shadow' and os.path.isdir(candidate):
            folder = candidate
            break
    else:
        sys.exit(f'aucun dossier card-shadow sous {base}')

matches = [f for f in os.listdir(folder) if f.endswith('.jsonl') and f.startswith(mission)]
if not matches:
    sys.exit(f'aucune trace pour la mission {mission} dans {folder}')
if len(matches) > 1:
    sys.exit('préfixe ambigu : ' + ', '.join(sorted(m[:-6] for m in matches)))
path = os.path.join(folder, matches[0])

lines = []
with open(path, encoding='utf-8') as handle:
    for raw in handle:
        try:
            lines.append(json.loads(raw))
        except ValueError:
            pass
print(f'Mission {matches[0][:-6]} : {len(lines)} écriture(s) observée(s) ({path})')
if len(lines) >= 500:
    print('Attention : borne de 500 lignes atteinte, les écritures suivantes ne sont pas notées.')

ACTUAL = ['card', 'cover', 'pass', 'blocked']
R2 = ['card', 'pass', 'unknown']
table = {}
for line in lines:
    key = (line.get('actuelle'), line.get('r2'))
    table[key] = table.get(key, 0) + 1
print()
print('actuelle \\ R2 ' + ''.join(f'{r:>9}' for r in R2) + '    total')
for a in ACTUAL + sorted({k[0] for k in table} - set(ACTUAL), key=str):
    row = [table.get((a, r), 0) for r in R2]
    other = sum(v for (x, r), v in table.items() if x == a and r not in R2)
    print(f'{str(a):<14}' + ''.join(f'{v:>9}' for v in row) + f'{sum(row) + other:>9}')


def card_like(actual):
    # La règle actuelle a demandé ou couvert une carte : « carte » des deux côtés.
    return actual in ('card', 'cover')


disagreements = [
    l for l in lines
    if l.get('r2') == 'unknown'
    or (l.get('r2') == 'card') != card_like(l.get('actuelle'))
]
print()
print(f'Désaccords : {len(disagreements)} (R2 inconnu compris)')
if disagreements:
    print(f"{'heure':<24} {'actuelle':<9} {'r2':<8} {'méthode':<7} {'hôte':<32} {'clic':<7} {'ms':>7} {'octets':>8}  raisons")
    for l in disagreements:
        ms = l.get('msDepuisLeClic')
        print(f"{str(l.get('heure'))[:23]:<24} {str(l.get('actuelle')):<9} {str(l.get('r2')):<8} "
              f"{str(l.get('méthode')):<7} {str(l.get('hôte'))[:32]:<32} {str(l.get('genreDuClic')):<7} "
              f"{'-' if ms is None else ms:>7} {l.get('octets', 0):>8}  "
              f"{', '.join(l.get('raisons') or []) or '-'}"
              f"{'' if l.get('corpsLisible', True) else ' [corps illisible]'}"
              f"{' [chemin de soumission]' if l.get('cheminDeSoumission') else ''}"
              f"{'' if l.get('mêmeSite', True) else ' [autre site]'}")
