#!/usr/bin/env python3
"""Relevé automatique des erreurs Relay, en lecture seule sur .data/platform.sqlite.

Usage : python3 .manager/registre-erreurs.py            suit les nouveaux événements (Ctrl-C pour arrêter)
        python3 .manager/registre-erreurs.py --depuis N --essai   relit à partir de l'événement N, sans rien écrire
Chaque erreur est ajoutée telle qu'enregistrée par Relay, sans interprétation, à la fin du registre.
"""
import json
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / '.data/platform.sqlite'
REG = ROOT / '.manager/reports/registre-erreurs.md'
SANS_REPONSE_S = 120
TYPES_ALERTE = re.compile(r'error|fail|diagnostic|silent|timeout|denied|refus|expired', re.I)
TEXTE_ERREUR = re.compile(
    r'^\s*(error|erreur)\b|"isError"\s*:\s*true|exit ?code\\*"?\s*[:=]\s*[1-9]|non autorisé', re.I
)
ESSAI = '--essai' in sys.argv


def court(text, n=220):
    text = re.sub(r'https?://([^/\s"\\]+)[^\s"\\]*', r'https://\1/…', str(text))
    text = re.sub(r'\s+', ' ', text).strip().replace('|', '/')
    return text[:n] + '…' if len(text) > n else text


def heure(at):
    return datetime.fromisoformat(at.replace('Z', '+00:00')).astimezone().strftime('%d/%m %H:%M:%S')


def texte_outil(u):
    parts = []
    for item in u.get('content') or []:
        c = item.get('content', item) if isinstance(item, dict) else item
        if isinstance(c, dict) and c.get('text'):
            parts.append(c['text'])
    if not parts and u.get('rawOutput') is not None:
        parts.append(json.dumps(u['rawOutput'], ensure_ascii=False))
    return ' '.join(parts)


vus = set()


def note(at, run, agent, nature, quoi, message):
    cle = (run, nature, quoi, message)
    if cle in vus:
        return
    vus.add(cle)
    ligne = f'| {heure(at)} | {run[:8]} | {agent} | {nature} | {court(quoi, 120)} | {court(message)} |'
    print(ligne, flush=True)
    if not ESSAI:
        with REG.open('a', encoding='utf-8') as f:
            f.write(ligne + '\n')


def main():
    db = sqlite3.connect(f'file:{DB}?mode=ro', uri=True, timeout=5)
    if '--depuis' in sys.argv:
        last = int(sys.argv[sys.argv.index('--depuis') + 1])
    else:
        last = db.execute('select coalesce(max(seq), 0) from events').fetchone()[0]
    print(f'Relevé à partir de l’événement {last}{" (essai, rien n’est écrit)" if ESSAI else ""}. Registre : {REG}', flush=True)
    agents, outils = {}, {}

    def agent_de(run):
        if run not in agents:
            row = db.execute("select json_extract(data, '$.agent') from runs where id = ?", (run,)).fetchone()
            agents[run] = (row and row[0]) or '?'
        return agents[run]

    while True:
        for seq, run, typ, data, at in db.execute(
            'select seq, run_id, type, data, at from events where seq > ? order by seq', (last,)
        ).fetchall():
            last = seq
            try:
                j = json.loads(data)
            except ValueError:
                j = {}
            if typ == 'agent':
                u = j.get('update', j)
                if u.get('sessionUpdate') not in ('tool_call', 'tool_call_update'):
                    continue
                o = outils.setdefault(u.get('toolCallId') or seq, {'run': run, 'titre': '', 'at': at, 'fin': False, 'signale': False})
                o['titre'] = u.get('title') or o['titre'] or json.dumps(u.get('rawInput', ''), ensure_ascii=False)
                status = u.get('status')
                if status in ('completed', 'failed'):
                    o['fin'] = True
                    texte = texte_outil(u)
                    if status == 'failed':
                        note(at, run, agent_de(run), 'Outil en échec', o['titre'], texte or 'échec sans message')
                    elif TEXTE_ERREUR.search(texte):
                        note(at, run, agent_de(run), 'Outil terminé avec erreur', o['titre'], texte)
            elif typ == 'state':
                if j.get('state') in ('failed', 'interrupted'):
                    row = db.execute("select json_extract(data, '$.error') from runs where id = ?", (run,)).fetchone()
                    note(at, run, agent_de(run), f'Mission {j["state"]}', '', (row and row[0]) or 'sans message')
                for o in outils.values():
                    if o['run'] == run and j.get('state') in ('completed', 'failed', 'cancelled', 'interrupted'):
                        if not o['fin'] and not o['signale']:
                            o['signale'] = True
                            note(at, run, agent_de(run), 'Outil sans état final', o['titre'], f'mission {j["state"]}')
                        o['fin'] = True
            elif TYPES_ALERTE.search(typ):
                if typ == 'agent_diagnostic' and not re.search(r'error|fail', data, re.I):
                    continue
                note(at, run, agent_de(run), f'Événement {typ}', '', data)
        maintenant = time.time()
        for o in outils.values():
            debut = datetime.fromisoformat(o['at'].replace('Z', '+00:00')).timestamp()
            if not o['fin'] and not o['signale'] and maintenant - debut > SANS_REPONSE_S:
                o['signale'] = True
                note(o['at'], o['run'], agent_de(o['run']), 'Outil sans réponse', o['titre'], f'aucun état final après {SANS_REPONSE_S} s')
        if ESSAI:
            return
        time.sleep(3)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
