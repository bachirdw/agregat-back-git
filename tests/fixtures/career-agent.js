// Agent ACP FICTIF : aucun modèle ni réseau externe. Exerce les outils carrière réels.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { connectMcp } from '../../packages/mcp-gateway/client.js';
let session;
// preuves-entre-tours-01 : la note attendue au tour de réponse (même processus, même session).
let pendingNote = null;
const app = agent({ name: 'career-FICTIF' })
  .onRequest(methods.agent.initialize, () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: 'FICTIF', version: '1' },
    agentCapabilities: { loadSession: true },
  }))
  .onRequest(methods.agent.session.new, (ctx) => {
    session = { ...ctx.params, sessionId: randomUUID(), model: process.env.GEMINI_MODEL };
    return {
      sessionId: session.sessionId,
      configOptions: [
        {
          id: 'model',
          name: 'Modèle',
          category: 'model',
          type: 'select',
          currentValue: process.env.GEMINI_MODEL,
          options: ['gemini-3.1-flash-lite', 'gemini-FICTIF-capable'].map((value) => ({
            value,
            name: value,
          })),
        },
      ],
    };
  })
  .onRequest(methods.agent.session.load, async (ctx) => {
    session = { ...ctx.params, sessionId: ctx.params.sessionId, model: process.env.GEMINI_MODEL };
    await connection.client.notify(methods.client.session.update, {
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'FICTIF-history',
        title: 'browser_click',
        status: 'failed',
      },
    });
    return { sessionId: session.sessionId };
  })
  .onRequest(methods.agent.session.setConfigOption, (ctx) => {
    if (ctx.params.configId === 'model') session.model = ctx.params.value;
    return { configOptions: [] };
  })
  .onRequest(methods.agent.session.prompt, async (ctx) => {
    const request = JSON.parse(ctx.params.prompt[0].text);
    const mcp = await connectMcp(session.mcpServers[0]);
    try {
      if (!request.ownerMode) {
        const native = await connection.client.request(methods.client.session.requestPermission, {
          sessionId: session.sessionId,
          toolCall: {
            toolCallId: 'FICTIF-native',
            title: 'Shell FICTIF interdit',
            kind: 'execute',
          },
          options: [{ optionId: 'allow', name: 'Autoriser', kind: 'allow_once' }],
        });
        if (native.outcome.outcome !== 'cancelled')
          throw new Error('Permission native contraire au mode FICTIF');
      }
      const call = async (name, args) => {
        const r = await mcp.callTool({ name, arguments: args });
        if (r.isError) throw new Error(r.content[0].text);
        return JSON.parse(r.content[0].text);
      };
      const cv = await call('career_read', { path: 'cv.md' });
      const send = async (summary) =>
        connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: JSON.stringify({ simulated: true, summary, evidence: [] }),
            },
          },
        });
      // preuves-entre-tours-01 (E35) : lecture au tour 1, question, note au tour suivant. Les preuves
      // navigateur sont postées comme le fait la passerelle réelle en mode propriétaire (URL et jeton
      // reçus dans la configuration MCP de la session) ; la page est FICTIVE.
      const relayEnv = (name) => session.mcpServers[0].env?.find((e) => e.name === name)?.value;
      const observe = async (capability, url) => {
        const response = await fetch(relayEnv('RELAY_EVIDENCE_URL'), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-platform-request': '1',
            'x-relay-token': relayEnv('RELAY_APPROVAL_TOKEN'),
          },
          body: JSON.stringify({
            capability,
            url,
            provider: 'fixture',
            ...(capability === 'browser.snapshot'
              ? { snapshot: 'Offre FICTIVE lisible : Poste FICTIF chez Entreprise FICTIVE.' }
              : { title: 'Offre FICTIVE' }),
            loading: false,
          }),
        });
        if (!response.ok) throw new Error('Preuve navigateur FICTIVE refusée');
      };
      const readUrl = 'https://jobs.example.test/entre-tours/42';
      const saveScored = (url) =>
        call('career_offer_save', {
          title: 'Poste FICTIF',
          company: 'Entreprise FICTIVE',
          url,
          source: 'Fixture locale FICTIVE, aucun accès réseau',
          fetchedAt: new Date().toISOString(),
          score: 3,
          report: Object.fromEntries(
            'ABCDEFG'.split('').map((key) => [key, `Analyse ${key} FICTIVE`]),
          ),
          simulated: true,
        });
      // preuves-entre-tours-01 point 5 (E1) : la page demandée redirige vers un autre hôte. La vraie
      // passerelle (BrowserGateway) sur un fournisseur FICTIF ; ses sorties sont postées comme le fait
      // mcp-gateway/server.js en mode propriétaire.
      if (request.objective?.includes('FICTIF_REDIRECTION')) {
        const { BrowserGateway, FixturePageProvider } = await import(
          '../../packages/browser-gateway/index.js'
        );
        const { RunPolicy } = await import('../../packages/policy-engine/run-policy.js');
        const { capabilityIds } = await import('../../packages/capability-registry/index.js');
        const page = { title: 'Offre FICTIVE', text: 'Offre FICTIVE lisible : Poste FICTIF.' };
        const gateway = new BrowserGateway({
          provider: new FixturePageProvider({
            'https://www.exemple.test/offre/1': { redirect: 'https://a.exemple.test/offre/1' },
            'https://a.exemple.test/offre/1': page,
          }),
          policy: new RunPolicy({
            ownerMode: true,
            allowedDomains: ['exemple.test'],
            capabilities: capabilityIds,
            resolveHost: async () => ['93.184.216.34'],
          }),
        });
        const post = async (output) => {
          const response = await fetch(relayEnv('RELAY_EVIDENCE_URL'), {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-platform-request': '1',
              'x-relay-token': relayEnv('RELAY_APPROVAL_TOKEN'),
            },
            body: JSON.stringify(output),
          });
          if (!response.ok) throw new Error('Preuve navigateur FICTIVE refusée');
        };
        await post(
          await gateway.call('browser.navigate', { url: 'https://www.exemple.test/offre/1' }),
        );
        await post(await gateway.call('browser.snapshot', {}));
        await saveScored(
          request.objective.includes('AUTRE_CHEMIN')
            ? 'https://www.exemple.test/offre/2'
            : 'https://www.exemple.test/offre/1',
        );
        await send('Offre FICTIVE lue après redirection, notée 3/5.');
        return { stopReason: 'end_turn' };
      }
      if (request.platform?.turnKind === 'answer' && pendingNote) {
        const url = pendingNote;
        pendingNote = null;
        await saveScored(url);
        await send(`Tour de réponse FICTIF : offre notée 3/5 (${request.answer?.reponse ?? ''}).`);
        return { stopReason: 'end_turn' };
      }
      if (request.objective?.includes('FICTIF_ENTRE_TOURS_SUITE')) {
        await saveScored(
          request.objective.includes('URL_JAMAIS_LUE')
            ? 'https://jobs.example.test/entre-tours/jamais-lue'
            : readUrl,
        );
        await send('Reprise FICTIVE : offre notée 3/5.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective?.includes('FICTIF_ENTRE_TOURS')) {
        await observe('browser.navigate', readUrl);
        await observe('browser.snapshot', readUrl);
        // Une étape du Skill faite au tour 1 (ligne de suivi), qui doit rester faite au tour 2.
        await call('career_write', {
          path: 'batch/tracker-additions/990-entreprise-fictive.tsv',
          text:
            'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl\n' +
            `990\t2026-11-05\tEntreprise FICTIVE\tPoste FICTIF\tEvaluated\t3/5\t❌\t—\tNote FICTIVE\t${readUrl}\n`,
        });
        const noteUrl = request.objective.includes('URL_JAMAIS_LUE')
          ? 'https://jobs.example.test/entre-tours/jamais-lue'
          : readUrl;
        if (request.objective.includes('SANS_QUESTION')) {
          await send('Offre FICTIVE lue ; la note viendra à la reprise.');
          return { stopReason: 'end_turn' };
        }
        if (request.objective.includes('FORMULAIRE')) {
          const answer = await connection.client.request(methods.client.elicitation.create, {
            sessionId: session.sessionId,
            toolCallId: 'FICTIF-ask',
            mode: 'form',
            message: 'Offre introuvable chez l’employeur FICTIF : évaluer quand même ?',
            requestedSchema: {
              type: 'object',
              properties: { reponse: { type: 'string', title: 'Réponse' } },
              required: ['reponse'],
            },
          });
          if (answer.action !== 'accept') throw new Error('Réponse FICTIVE attendue');
          await saveScored(noteUrl);
          await send('Formulaire FICTIF : offre notée 3/5.');
          return { stopReason: 'end_turn' };
        }
        pendingNote = noteUrl;
        await connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: JSON.stringify({
                simulated: true,
                summary: 'Offre FICTIVE lue.',
                evidence: [],
                question: {
                  message: 'Offre introuvable chez l’employeur FICTIF : évaluer quand même ?',
                  options: ['oui', 'non'],
                },
              }),
            },
          },
        });
        return { stopReason: 'end_turn' };
      }
      // A page read before the note: the platform now reports a note saved without one.
      const readOffer = async () => {
        await call('career_write', { path: 'jds/offre-fictive.md', text: 'Offre FICTIVE lue' });
        await call('career_read', { path: 'jds/offre-fictive.md' });
      };
      if (request.objective.includes('FICTIF_LENT'))
        await new Promise((resolve) => setTimeout(resolve, 12000));
      if (request.objective.includes('FICTIF_PROFIL')) {
        await send('Questions FICTIVES : 1. Quelle ville visez-vous ? 2. Quel poste visez-vous ?');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_PRIORITE')) {
        const instructions = request.instructions ?? '';
        if (
          !instructions.startsWith('Active le Skill career-ops') ||
          instructions.includes('clique le bouton final') ||
          instructions.includes('priment sur les règles')
        )
          throw new Error('Consignes FICTIVES : le Skill doit arriver en tête, sans levée');
        await send('Consigne FICTIVE : le Skill en tête, sans levée.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_ROUTEUR')) {
        if (
          !request.instructions.includes('Le manifeste suivant sert au suivi') ||
          !request.instructions.includes('suis exactement sa méthode') ||
          request.instructions.indexOf('career_script') >
            request.instructions.indexOf('career_offer_save')
        )
          throw new Error('Ordre du Skill absent du prompt FICTIF');
        await send('Ordre du Skill FICTIF reçu.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_ACTION_ECHOUEE')) {
        await connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'FICTIF-click',
            title: 'browser_click',
            status: 'in_progress',
          },
        });
        await connection.client.notify(methods.client.session.update, {
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'FICTIF-click',
            status: 'failed',
            rawOutput: {
              error: 'LinkedIn : écriture automatisée interdite',
              private: 'DONNÉE_PRIVÉE_FICTIVE',
            },
          },
        });
        await send('Terminé.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_RESULTATS_MIXTES')) {
        // E29 (mission 380ef9ff reconstituée) : le même outil réussit puis échoue dans le tour.
        for (const [id, status] of [
          ['FICTIF-extract-ok', 'completed'],
          ['FICTIF-extract-ko', 'failed'],
        ]) {
          await connection.client.notify(methods.client.session.update, {
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: id,
              title: 'browser_extract',
              status: 'in_progress',
            },
          });
          await connection.client.notify(methods.client.session.update, {
            sessionId: session.sessionId,
            update: { sessionUpdate: 'tool_call_update', toolCallId: id, status },
          });
        }
        await send('Terminé.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_NOTES_SANS_SOURCE')) {
        await send('Correspondance parfaite 5/5 pour une offre FICTIVE.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_REPONSE')) {
        await call('career_write', {
          path: 'modes/_profile.md',
          text: `# Profil FICTIF\n\nRéponse : ${request.objective}\n`,
        });
        await send(
          'Profil FICTIF enregistré dans modes/_profile.md ; réponse reçue : ' + request.objective,
        );
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_REPRISE_RAPIDE')) {
        await send('Candidature FICTIVE prétendument envoyée sans outil navigateur.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_NOTE_HORS_INTENT')) {
        if (request.instructions.split('Ne note une offre qu’après avoir lu sa page').length !== 2)
          throw new Error('La consigne de lecture avant note doit figurer une seule fois');
        const scored = !request.objective.includes('SANS_NOTE_FICTIVE');
        await call('career_offer_save', {
          title: 'Poste FICTIF',
          company: 'Entreprise FICTIVE',
          url: 'https://jobs.example.test/fictif',
          source: 'Fixture locale FICTIVE, aucun accès réseau',
          fetchedAt: new Date().toISOString(),
          ...(scored
            ? {
                score: 2,
                report: Object.fromEntries(
                  'ABCDEFG'.split('').map((key) => [key, `Analyse ${key} FICTIVE`]),
                ),
              }
            : {}),
          simulated: true,
        });
        await send('Offre FICTIVE enregistrée sans lecture de sa page.');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_RECHERCHE')) {
        await readOffer();
        if (request.instructions.split('Ne note une offre qu’après avoir lu sa page').length !== 2)
          throw new Error('La consigne de lecture avant note doit figurer une seule fois');
        await call('career_offer_save', {
          title: 'Poste FICTIF',
          company: 'Entreprise FICTIVE',
          url: 'https://jobs.example.test/fictif',
          source: 'Fixture locale FICTIVE, aucun accès réseau',
          fetchedAt: new Date().toISOString(),
          score: 4,
          report: Object.fromEntries(
            'ABCDEFG'.split('').map((key) => [key, `Analyse ${key} FICTIVE`]),
          ),
          simulated: true,
        });
        await send('Recherche FICTIVE : offre enregistrée, note 4/5 et rapport A–G.');
        return { stopReason: 'end_turn' };
      }
      // production-01 : CV adapté et lettre par la chaîne du Skill (modes/pdf.md 17b–21 + mark-pdf-ready,
      // modes/cover.md étape 9). FICTIF_CV_INVENTE : le payload invente des faits, verify-cv-facts refuse,
      // l'agent s'arrête avant le PDF (pdf.md étape 19 : « hard gate before PDF rendering »).
      if (request.objective.includes('FICTIF_SKILL_CV')) {
        const num = '042';
        const date = new Date().toISOString().slice(0, 10);
        const json = `output/cv-candidat-fictif-${num}-entreprise-fictive.json`;
        const html = `output/cv-candidat-fictif-${num}-entreprise-fictive.html`;
        const pdf = `output/cv-candidat-fictif-${num}-entreprise-fictive-${date}.pdf`;
        const invented = request.objective.includes('FICTIF_CV_INVENTE');
        await call('career_read', { path: 'config/profile.yml' });
        await call('career_write', {
          path: json,
          text: JSON.stringify({
            candidate: { name: 'Candidat FICTIF', email: 'candidat@example.test' },
            summary: 'Ingénieur FICTIF.',
            experience: [
              {
                company: 'Entreprise FICTIVE',
                role: 'Ingénieur logiciel FICTIF',
                dates: '2021 – 2026',
                bullets: invented
                  ? ['Réduit la latence de 90% en Rust FICTIF', 'Dirigé 25 personnes FICTIVES']
                  : ['Réduit la latence de 40% en Node.js FICTIF'],
              },
            ],
          }),
        });
        await call('career_script', { command: 'verify-cv-structure', args: [json] });
        const template = (
          await call('career_script', { command: 'cv-templates', args: ['resolve', 'cv'] })
        ).text.trim();
        const built = await call('career_script', {
          command: 'build-cv-html',
          args: [json, html, template],
        });
        if (built.exitCode !== 0) throw new Error('build-cv-html FICTIF : ' + built.text);
        const facts = await call('career_script', { command: 'verify-cv-facts', args: [html] });
        if (facts.exitCode !== 0) {
          await send(`CV FICTIF non vérifié, aucun PDF produit (pdf.md étape 19) : ${facts.text}`);
          return { stopReason: 'end_turn' };
        }
        const rendered = await call('career_script', {
          command: 'generate-pdf',
          args: [html, pdf, '--format=a4', `--report=${num}`],
        });
        if (rendered.exitCode !== 0) throw new Error('generate-pdf FICTIF : ' + rendered.text);
        const marked = await call('career_script', { command: 'mark-pdf-ready', args: [num] });
        let letter = '';
        if (/\blettre\b/i.test(request.objective)) {
          const payload = 'output/cover-payload-entreprise-fictive.json';
          await call('career_write', {
            path: payload,
            text: JSON.stringify({
              candidate: { name: 'Candidat FICTIF' },
              letter: {
                role_title: 'Poste FICTIF',
                company: 'Entreprise FICTIVE',
                opening: 'Lettre FICTIVE.',
              },
              output_path: 'output/entreprise-fictive-poste-fictif-cover.pdf',
            }),
          });
          const cover = await call('career_script', {
            command: 'generate-cover-letter',
            args: ['--payload', payload],
          });
          if (cover.exitCode !== 0) throw new Error('generate-cover-letter FICTIF : ' + cover.text);
          letter = ` Lettre FICTIVE : ${cover.text.trim()}.`;
        }
        await send(
          `CV FICTIF produit par le Skill : ${pdf} (rapport ${num}, colonne PDF : ${marked.text.trim()}).${letter}`,
        );
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_CV_LETTRE')) {
        await call('career_write', {
          path: 'output/cv-fictif.md',
          text: '# CV adapté FICTIF\n' + cv.text,
        });
        await call('career_write', {
          path: 'output/lettre-fictive.md',
          text: '# Lettre FICTIVE\n' + cv.text,
        });
        await send(
          'CV et lettre FICTIFS dans output/cv-fictif.md et output/lettre-fictive.md. Manques FICTIFS : expérience Kubernetes non attestée. Aucun envoi.',
        );
        return { stopReason: 'end_turn' };
      }
      // skill-suivi-01 : « coller une URL » selon le Skill (auto-pipeline, oferta « Post-evaluation »).
      if (request.objective.includes('FICTIF_SKILL_URL')) {
        const url = 'https://jobs.example.test/offre/42';
        await readOffer();
        const live = await call('career_script', { command: 'check-liveness', args: [url] });
        if (live.exitCode !== 0) throw new Error('Vivacité FICTIVE inattendue');
        const num = (await call('career_script', { command: 'reserve-report-num' })).text.trim();
        const date = new Date().toISOString().slice(0, 10);
        const report = `reports/${num}-entreprise-fictive-${date}.md`;
        await call('career_write', {
          path: report,
          text: [
            '# Evaluation: Entreprise FICTIVE — Poste FICTIF',
            '',
            `**Date:** ${date}`,
            `**URL:** ${url}`,
            '**Via:** —',
            '**Archetype:** Not a target — no close match',
            '**Score:** 4.5/5',
            '**Decision:** Apply',
            '**Legitimacy:** High Confidence',
            '**Work Auth:** ➖ Not needed',
            '**PDF:** pending',
            '',
            'Verdict FICTIF.',
            '',
            '---',
            '',
            ...'ABCDEFG'
              .split('')
              .map((key) => `## ${key}) Bloc FICTIF\n\nAnalyse ${key} FICTIVE.\n`),
            '## H) Draft Application Answers\n\nRéponses FICTIVES (note ≥ 4,5).\n',
            '## Job Description (archived verbatim)\n\nPosted: not visible in source\nOffre FICTIVE lue\n',
            '## Machine Summary\n\n```yaml\nfinal_decision: Apply\nadvertised_comp: null\n```\n',
          ].join('\n'),
        });
        await call('career_script', { command: 'reserve-report-num', args: ['--release', num] });
        await call('career_write', {
          path: `batch/tracker-additions/${num}-entreprise-fictive.tsv`,
          text:
            'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl\n' +
            `${num}\t${date}\tEntreprise FICTIVE\tPoste FICTIF\tEvaluated\t4.5/5\t❌\t[${num}](${report})\tNote FICTIVE\t${url}\n`,
        });
        const merged = await call('career_script', { command: 'merge-tracker' });
        if (merged.exitCode !== 0) throw new Error('Fusion FICTIVE échouée : ' + merged.text);
        await send(`Évaluation FICTIVE selon le Skill : ${report}, note 4.5/5, suivi fusionné.`);
        return { stopReason: 'end_turn' };
      }
      // pipeline-01 : « traite la boîte d'entrée » selon modes/pipeline.md (balayage de vivacité,
      // puis chaque « - [ ] » évaluée comme une annonce collée, puis cochée ; une page inaccessible
      // devient « - [!] » sans évaluation). « n'enregistre rien » : lecture et contrôles seulement.
      if (request.objective.includes('FICTIF_PIPELINE')) {
        const dry = /n[’']enregistre rien/i.test(request.objective);
        const inbox = await call('career_read', { path: 'data/pipeline.md' });
        const pending = [...inbox.text.matchAll(/^- \[ \] (https?:\/\/\S+)(.*)$/gm)].map((m) => ({
          url: m[1],
          line: m[0],
        }));
        const live = await call('career_script', {
          command: 'check-liveness',
          args: pending.map((entry) => entry.url),
        });
        if (live.exitCode !== 0) throw new Error('Vivacité FICTIVE inattendue');
        const date = new Date().toISOString().slice(0, 10);
        let processed = 0;
        for (const entry of pending) {
          await call('career_script', {
            command: 'precheck-duplicate',
            args: [
              '--company',
              'Entreprise FICTIVE',
              '--title',
              'Poste FICTIF',
              '--url',
              entry.url,
            ],
          });
          if (dry) continue;
          const current = (await call('career_read', { path: 'data/pipeline.md' })).text;
          if (entry.url.endsWith('/3')) {
            // Page FICTIVE derrière une connexion : non confirmée, jamais « fermée » sans preuve.
            await call('career_write', {
              path: 'data/pipeline.md',
              text: current.replace(entry.line, `- [!] ${entry.url} — Error: login required`),
            });
            continue;
          }
          await call('career_write', {
            path: `jds/offre-fictive-${++processed}.md`,
            text: `Offre FICTIVE lue : ${entry.url}`,
          });
          await call('career_read', { path: `jds/offre-fictive-${processed}.md` });
          const num = (await call('career_script', { command: 'reserve-report-num' })).text.trim();
          const report = `reports/${num}-entreprise-fictive-${date}.md`;
          await call('career_write', {
            path: report,
            text: [
              '# Evaluation: Entreprise FICTIVE — Poste FICTIF',
              '',
              `**Date:** ${date}`,
              `**URL:** ${entry.url}`,
              '**Score:** 4.5/5',
              '**Legitimacy:** High Confidence',
              '**PDF:** not generated',
              '',
              ...'ABCDEFG'
                .split('')
                .map((key) => `## ${key}) Bloc FICTIF\n\nAnalyse ${key} FICTIVE.\n`),
              '## Job Description (archived verbatim)\n\nOffre FICTIVE lue\n',
              '## Machine Summary\n\n```yaml\nfinal_decision: Apply\n```\n',
            ].join('\n'),
          });
          await call('career_script', { command: 'reserve-report-num', args: ['--release', num] });
          await call('career_write', {
            path: `batch/tracker-additions/${num}-entreprise-fictive.tsv`,
            text:
              'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl\n' +
              `${num}\t${date}\tEntreprise FICTIVE\tPoste FICTIF\tEvaluated\t4.5/5\t❌\t[${num}](${report})\tNote FICTIVE\t${entry.url}\n`,
          });
          const merged = await call('career_script', { command: 'merge-tracker' });
          if (merged.exitCode !== 0) throw new Error('Fusion FICTIVE échouée : ' + merged.text);
          const ticked = `- [x] #${num} | ${entry.url} | Entreprise FICTIVE | Poste FICTIF | 4.5/5 | PDF ❌`;
          await call('career_write', {
            path: 'data/pipeline.md',
            text:
              current
                .replace(entry.line + '\n', '')
                .replace(/\n## Processed\n/, '\n## Processed\n') +
              ticked +
              '\n',
          });
        }
        await send(
          dry
            ? `Boîte d'entrée FICTIVE lue : ${pending.length} entrées, rien d'enregistré.`
            : `Boîte d'entrée FICTIVE traitée : ${processed} évaluées, 1 non confirmée.`,
        );
        return { stopReason: 'end_turn' };
      }
      await readOffer();
      let controlEvidence = '';
      if (request.objective.includes('CONTROLES_FICTIFS')) {
        const gap = await call('career_script', {
          command: 'jd-skill-gap',
          path: 'jds/offre.md',
        });
        controlEvidence = JSON.parse(gap.text).gap.join(',');
      }
      await call('career_offer_save', {
        title: 'Poste FICTIF',
        company: 'Entreprise FICTIVE',
        url: 'https://jobs.example.test/fictif',
        source: 'Fixture locale FICTIVE, aucun accès réseau',
        fetchedAt: new Date().toISOString(),
        score: 4,
        report: Object.fromEntries(
          'ABCDEFGH'.split('').map((key) => [key, 'Rapport FICTIF : ' + cv.text]),
        ),
        simulated: true,
      });
      await call('linkedin_draft', {
        url: 'https://www.linkedin.com/in/fictif/',
        text: 'Message FICTIF privé : ' + cv.text,
      });
      await connection.client.notify(methods.client.session.update, {
        sessionId: session.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: request.objective.includes('TEXTE_LIBRE')
              ? 'Questions FICTIVES : quels postes visez-vous ?'
              : request.objective.includes('MODELE_FICTIF')
                ? `Modèle FICTIF : env=${process.env.GEMINI_MODEL} session=${session.model}`
                : JSON.stringify({
                    simulated: true,
                    summary: request.objective + cv.text + controlEvidence,
                    privateProfile: cv.text,
                    evidence: [{ text: cv.text }],
                  }),
          },
        },
      });
      return { stopReason: 'end_turn' };
    } finally {
      await mcp.close();
    }
  });
const connection = app.connect(
  ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin)),
);
