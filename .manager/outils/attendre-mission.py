"""Attente en LECTURE SEULE d'une mission terminée sur l'API Relay.

Ne fait que GET /api/runs toutes les 20 s. N'approuve rien, ne répond à rien.
Usage : python3 -I attendre-mission.py <port> <fichier d'état> <secondes max>
Le fichier d'état garde les identifiants déjà relevés (créé au premier appel avec
toutes les missions existantes). Sortie, une seule ligne utile :
  MISSION_FINIE <id> <state> <agent> <model> <createdAt> <finishedAt>
  EN_COURS <id8> ...        (mission vue, pas encore finie, à la fin du délai)
  RIEN                       (aucune mission nouvelle dans le délai)
"""
import json
import os
import sys
import time
import urllib.request

port, state_path, max_seconds = sys.argv[1], sys.argv[2], int(sys.argv[3])
URL = f"http://127.0.0.1:{port}/api/runs"
HEADERS = {"x-platform-request": "1"}
deadline = time.time() + max_seconds


def runs():
    request = urllib.request.Request(URL, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=10) as response:
        data = json.load(response)
    return data if isinstance(data, list) else data.get("runs", [])


def load():
    with open(state_path, encoding="utf-8") as handle:
        return {line.strip() for line in handle if line.strip()}


known = None
if os.path.exists(state_path):
    known = load()
unreachable = 0
running = []
while True:
    try:
        current = runs()
        unreachable = 0
        if known is None:
            known = {run["id"] for run in current}
            with open(state_path, "w", encoding="utf-8") as handle:
                handle.write("\n".join(sorted(known)) + "\n")
        fresh = sorted(
            (run for run in current if run["id"] not in known),
            key=lambda run: run.get("createdAt") or "",
        )
        done = [run for run in fresh if run.get("finishedAt")]
        running = [run for run in fresh if not run.get("finishedAt")]
        if done:
            run = done[0]
            with open(state_path, "a", encoding="utf-8") as handle:
                handle.write(run["id"] + "\n")
            print(
                "MISSION_FINIE",
                run["id"],
                run.get("state"),
                run.get("agent"),
                run.get("model") or "-",
                run.get("createdAt"),
                run.get("finishedAt"),
            )
            sys.exit(0)
    except Exception as error:  # API arrêtée ou relancée : on réessaie
        unreachable += 1
    if time.time() >= deadline:
        break
    time.sleep(20)

if running:
    print("EN_COURS", " ".join(f"{run['id'][:8]}:{run.get('state')}:{run.get('agent')}" for run in running))
elif unreachable:
    print("RIEN (API injoignable aux", unreachable, "dernières lectures)")
else:
    print("RIEN")
