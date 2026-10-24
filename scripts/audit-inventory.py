"""Inventaire reproductible des clones ; ne lance aucun code tiers."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("root", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
records = []
for repo in sorted(args.root.iterdir()):
    if not (repo / ".git").exists():
        continue

    def git(*argv):
        return subprocess.check_output(["git", "-C", str(repo), *argv], text=True).strip()

    licenses = []
    license_paths = [
        p for p in sorted(repo.iterdir())
        if p.is_file() and p.name.upper().startswith(("LICENSE", "LICENCE", "COPYING", "NOTICE"))
    ]
    if repo.name == "anthropics__skills":
        license_paths += [repo / "skills/skill-creator/LICENSE.txt", repo / "skills/docx/LICENSE.txt"]
    for path in license_paths:
        content = path.read_bytes()
        licenses.append({
            "path": str(path.relative_to(repo)),
            "sha256": hashlib.sha256(content).hexdigest(),
            "firstLines": content.decode(errors="replace").splitlines()[:10],
        })
    manifests = []
    for name in ["package.json", "pyproject.toml", "Cargo.toml", "packages/cli/package.json",
                 "playwriter/package.json", "packages/tiny-agents/package.json",
                 "packages/mcp-client/package.json"]:
        path = repo / name
        if not path.exists():
            continue
        content = path.read_text()
        if path.suffix == ".json":
            data = json.loads(content)
            value = {k: data[k] for k in ["name", "version", "license", "engines", "dependencies",
                                         "workspaces", "bin", "exports"] if k in data}
        else:
            import tomllib
            data = tomllib.loads(content)
            value = {k: data[k] for k in ["project", "package", "dependencies", "workspace"] if k in data}
        manifests.append({"path": name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), **value})
    records.append({
        "directory": repo.name,
        "origin": git("remote", "get-url", "origin"),
        "sha": git("rev-parse", "HEAD"),
        "lastCommit": git("log", "-1", "--format=%cI %s"),
        "shallow": git("rev-parse", "--is-shallow-repository") == "true",
        "status": git("status", "--short"),
        "licenses": licenses,
        "manifests": manifests,
    })
args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
print(f"{len(records)} dépôts inventoriés dans {args.output}")
