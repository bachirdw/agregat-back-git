import json,pathlib,subprocess,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1];rows=json.loads((root/'docs/research/sources.json').read_text())
extra={'zetbrush/multiagents':['adapters/codex-adapter.ts','orchestrator/guardrails.ts'],'suyashb734/cliagents':['src/adapters/codex-cli.js','src/orchestration/run-ledger.js'],'awslabs/cli-agent-orchestrator':['src/cli_agent_orchestrator/backends/tmux_backend.py'],'openclaw/acpx':['src/acp/client.ts','src/acp/client-protocol.ts','src/permissions.ts','docs/permissions.md'],'agentclientprotocol/codex-acp':['examples/simple-client.ts','src/AcpV2Permissions.ts'],'agentclientprotocol/claude-agent-acp':['src/acp-agent.ts'],'remorses/playwriter':['playwriter/src/cdp-relay.ts','playwriter/src/mcp.ts','extension/src/background.ts'],'microsoft/playwright-mcp':['index.js','cli.js'],'rosslevinsky/portable-agent-skills':['skills/web-verify/SKILL.md'],'anthropics/skills':['skills/frontend-design/SKILL.md','skills/frontend-design/LICENSE.txt'],'google-gemini/gemini-cli':['packages/cli/src/acp/acpSession.ts','docs/cli/acp-mode.md'],'anomalyco/opencode':['packages/cli/src/acp/permission.ts','packages/cli/src/acp/sessions.ts']}
def fetch(t):
 r,p=t;d=root/'.research'/r['repo'].replace('/','__')/p;d.parent.mkdir(parents=True,exist_ok=True)
 v=subprocess.run(['curl','-fsSL','--max-time','30',f'https://raw.githubusercontent.com/{r["repo"]}/{r["sha"]}/{p}'],capture_output=True,text=True)
 if v.returncode==0:d.write_text(v.stdout);return r['repo'],p
 return r['repo'],None
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for repo,p in pool.map(fetch,[(r,p) for r in rows for p in extra.get(r['repo'],[])]):
  if p:next(r for r in rows if r['repo']==repo)['files'].append(p)
(root/'docs/research/sources.json').write_text(json.dumps(rows,indent=2))
