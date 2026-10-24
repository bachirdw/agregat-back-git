import json, pathlib, subprocess, concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1]
repos=['zetbrush/multiagents','suyashb734/cliagents','osanoai/multicli','Heretyc/subagent-mcp','awslabs/cli-agent-orchestrator','openclaw/acpx','agentclientprotocol/agent-client-protocol','agentclientprotocol/codex-acp','agentclientprotocol/claude-agent-acp','modelcontextprotocol/typescript-sdk','anthropics/skills','rosslevinsky/portable-agent-skills','vercel-labs/skills','remorses/playwriter','babelcloud/playwriter-browser-mcp','microsoft/playwright-mcp','huggingface/smolagents','huggingface/transformers','google-gemini/gemini-cli','anomalyco/opencode']
def get(url):
 p=subprocess.run(['curl','-fsSL','--max-time','40',url],capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr.strip())
 return p.stdout

def inspect(repo):
 out={'repo':repo}; dest=ROOT/'.research'/repo.replace('/','__'); dest.mkdir(parents=True,exist_ok=True)
 try:
  meta=json.loads(get('https://api.github.com/repos/'+repo)); branch=meta['default_branch']
  tree=json.loads(get(f'https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1'))
  out.update({k:meta.get(k) for k in ['pushed_at','archived','language','license','html_url']});out['sha']=tree['sha']
  paths=[x['path'] for x in tree['tree'] if x['type']=='blob'];(dest/'tree.json').write_text(json.dumps(paths))
  base=[p for p in paths if p.lower() in ['readme.md','license','license.md','license.txt','package.json','pyproject.toml']]
  code=[p for p in paths if p.endswith(('.ts','.py','.rs')) and not any(s in p for s in ['test','spec','lock','example','generated']) and any(s in p.lower() for s in ['session','agent','client','server','permission','relay','executor'])]
  selected=base+code[:5];out['files']=selected
  for p in selected:
   f=dest/p;f.parent.mkdir(parents=True,exist_ok=True)
   try:f.write_text(get(f'https://raw.githubusercontent.com/{repo}/{tree["sha"]}/{p}'))
   except Exception as e:out.setdefault('file_errors',[]).append(str(e))
 except Exception as e:out['error']=str(e)
 print(repo, out.get('sha',out.get('error')),flush=True)
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(inspect,repos))
(ROOT/'docs/research/sources.json').write_text(json.dumps(results,indent=2))
