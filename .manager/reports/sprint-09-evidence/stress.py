# Diagnostic reproductible du sprint 09 : 64 essais, concurrence 8, sites fictifs.
import concurrent.futures, subprocess, time, os, signal, re
from pathlib import Path
root=Path(__file__).resolve().parents[3];start=time.monotonic()
env={**os.environ,'BROWSER_STRESS_TRACE':'1','DEBUG':'pw:api,pw:browser'}
def run(i):
    path=Path(f'/tmp/sprint09-trace-{i:02}.log')
    with path.open('w') as log:
        process=subprocess.Popen(['node','--test','--test-name-pattern=champ mot de passe','--test-timeout=15000','tests/browser-gateway.test.js'],cwd=root,stdout=log,stderr=subprocess.STDOUT,text=True,start_new_session=True,env=env)
        try: code=process.wait(timeout=35)
        except subprocess.TimeoutExpired:
            code=124
            log.write('\nSUPERVISEUR : délai 35 s dépassé\n');log.flush()
            try: os.killpg(process.pid,signal.SIGKILL)
            except ProcessLookupError: pass
            process.wait()
        if code:
            log.flush()
            for pid in re.findall(r'<launched> pid=(\d+)',path.read_text()):
                pid=int(pid)
                check=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True)
                if '--user-data-dir=' in check.stdout and 'playwright_chromiumdev_profile-' in check.stdout:
                    log.write(f'NETTOYAGE Chrome temporaire identifié : {pid}\n');log.flush()
                    try: os.killpg(pid,signal.SIGKILL)
                    except ProcessLookupError:
                        try: os.kill(pid,signal.SIGKILL)
                        except ProcessLookupError: pass
        print(f'Essai {i:02}/64 : code {code}',flush=True)
    return i,code
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(run,range(1,65)))
print(f'TOTAL: {sum(code==0 for _,code in results)}/64 ; concurrence 8 ; durée {time.monotonic()-start:.2f}s ; échecs {[i for i,code in results if code]}',flush=True)
raise SystemExit(any(code for _,code in results))
