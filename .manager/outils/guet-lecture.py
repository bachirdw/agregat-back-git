"""Guetteur en LECTURE SEULE : attend une nouvelle mission sur l'API donnée et sa fin.

N'approuve rien, ne répond à rien, n'écrit rien : seulement GET /api/runs.
Usage : python3 guet-lecture.py <port> <minutes max>
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone

port, max_minutes = sys.argv[1], int(sys.argv[2])
base = f"http://127.0.0.1:{port}"
start = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
deadline = time.time() + max_minutes * 60


def runs():
    with urllib.request.urlopen(f"{base}/api/runs", timeout=10) as response:
        return json.load(response)


seen = None
while time.time() < deadline:
    try:
        fresh = [run for run in runs() if (run.get("createdAt") or "") > start]
    except Exception as error:  # API momentanément injoignable : on réessaie
        print("lecture impossible:", type(error).__name__, flush=True)
        time.sleep(15)
        continue
    for run in fresh:
        if seen != run["id"] and not run.get("finishedAt"):
            seen = run["id"]
            print("mission vue:", run["id"][:8], run.get("agent"), run.get("model"), run.get("createdAt"), flush=True)
    done = [run for run in fresh if run.get("finishedAt")]
    if done:
        run = done[0]
        notes = (run.get("result") or {}).get("platformNotes") or []
        print("mission finie:", run["id"], run.get("state"), run.get("agent"), run.get("createdAt"), run.get("finishedAt"))
        for line in notes:
            if line.startswith(("Envoi", "Requêtes", "- Actions", "- Résultats", "- Non exécuté", "- Étapes")):
                print(line)
        sys.exit(0)
    time.sleep(10)
print("aucune mission terminée dans le délai")
