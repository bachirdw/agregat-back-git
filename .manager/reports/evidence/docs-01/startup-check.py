"""Vérifie les commandes README dans une copie sans .data, sans appel modèle."""
import os, pathlib, shutil, signal, socket, subprocess, tempfile, time, re, urllib.request
root=pathlib.Path.cwd()
evidence=root/'.manager/reports/evidence/docs-01'
with tempfile.TemporaryDirectory(prefix='relay-docs-start-') as tmp:
    work=pathlib.Path(tmp)
    for name in ['apps','packages','domain-packs','tests','scripts']:
        shutil.copytree(root/name,work/name)
    for name in ['package.json','package-lock.json']:
        shutil.copy(root/name,work/name)
    (work/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
    cases=[('default',{},4310),('port-4311',{},4311),('port-zero',{},0),
           ('live',{'AGENT_PLATFORM_LIVE':'1'},0),
           ('fixture',{'AGENT_PLATFORM_BROWSER':'fixture'},0),
           ('isolated',{'AGENT_PLATFORM_BROWSER':'isolated','AGENT_PLATFORM_LIVE':'1','AGENT_PLATFORM_CHROME_PATH':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'},0),
           ('playwriter',{'AGENT_PLATFORM_BROWSER':'playwriter','AGENT_PLATFORM_LIVE':'1'},0),
           ('owner',{'AGENT_PLATFORM_OWNER_MODE':'1','AGENT_PLATFORM_LIVE':'1','AGENT_PLATFORM_BROWSER':'playwriter','PLAYWRITER_TELEMETRY':'0'},0)]
    for label, settings, port in cases:
        path=evidence/f'start-{label}.txt'
        with path.open('w') as out:
            if port:
                sock=socket.socket()
                try: sock.bind(('127.0.0.1',port))
                except OSError as err:
                    out.write(f'Port {port} occupé : commande non lancée ({err}); variante PORT=0 testée séparément.\n')
                    sock.close(); continue
                sock.close()
            env={k:v for k,v in os.environ.items() if not k.startswith(('AGENT_PLATFORM_','RELAY_')) and k not in ['GEMINI_API_KEY','GOOGLE_API_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY','CODEX_API_KEY']}
            env.update(settings)
            if label!='default': env['PORT']=str(port)
            else: env.pop('PORT',None)
            out.write(f'Copie temporaire : {work}\n$ '+ ' '.join(f'{k}={v}' for k,v in settings.items())+(' ' if settings else '')+('' if label=='default' else f'PORT={port} ')+'npm start\n')
            out.flush()
            proc=subprocess.Popen(['npm','start'],cwd=work,env=env,stdout=out,stderr=out,start_new_session=True)
            try:
                until=time.monotonic()+30
                while time.monotonic()<until:
                    out.flush(); content=path.read_text()
                    found=re.search(r'Agent Platform : (http://127.0.0.1:\d+)',content)
                    if found: break
                    if proc.poll() is not None: raise RuntimeError(f'sortie prématurée {proc.returncode}')
                    time.sleep(.1)
                else: raise TimeoutError('démarrage > 30 s')
                for route in ['/','/api/catalog','/api/runs']:
                    with urllib.request.urlopen(found[1]+route,timeout=20) as response:
                        body=response.read()
                        out.write(f'GET {route} -> HTTP {response.status}, {len(body)} octets\n')
                out.write('Aucun run créé, aucun outil navigateur appelé, aucune inférence.\n')
            finally:
                os.killpg(proc.pid,signal.SIGTERM)
                try: proc.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid,signal.SIGKILL);proc.wait()
                    out.write('SIGKILL nécessaire après 15 s.\n')
                out.write(f'Groupe npm arrêté, code de sortie {proc.returncode}.\n')
        print(path.name+': '+path.read_text().splitlines()[-1],flush=True)
