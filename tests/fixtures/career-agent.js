// Agent ACP FICTIF : aucun modèle ni réseau externe. Exerce les outils carrière réels.
import { agent, methods, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { connectMcp } from '../../packages/mcp-gateway/client.js';
let session;
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
      const native = await connection.client.request(methods.client.session.requestPermission, {
        sessionId: session.sessionId,
        toolCall: { toolCallId: 'FICTIF-native', title: 'Shell FICTIF interdit', kind: 'execute' },
        options: [{ optionId: 'allow', name: 'Autoriser', kind: 'allow_once' }],
      });
      if (native.outcome.outcome !== 'cancelled') throw new Error('Shell natif non bloqué');
      const call = async (name, args) => {
        const r = await mcp.callTool({ name, arguments: args });
        if (r.isError) throw new Error(r.content[0].text);
        return JSON.parse(r.content[0].text);
      };
      const cv = await call('career_read', { path: 'cv.md' });
      if (request.objective.includes('FICTIF_LENT'))
        await new Promise((resolve) => setTimeout(resolve, 12000));
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
      if (request.objective.includes('FICTIF_PROFIL')) {
        await send('Questions FICTIVES : 1. Quelle ville visez-vous ? 2. Quel poste visez-vous ?');
        return { stopReason: 'end_turn' };
      }
      if (request.objective.includes('FICTIF_PRIORITE')) {
        const instructions = request.instructions ?? '';
        if (
          !instructions.startsWith('Si un mode du Skill') ||
          !instructions.includes('clique le bouton final seulement si le prompt') ||
          instructions.indexOf('clique le bouton final seulement si le prompt') >
            instructions.indexOf('Active le Skill')
        )
          throw new Error('Priorité de la plateforme absente du prompt FICTIF');
        await send('Consigne prioritaire FICTIVE reçue avant le Skill.');
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
      if (request.objective.includes('FICTIF_RECHERCHE')) {
        await call('career_offer_save', {
          id: randomUUID(),
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
      let controlEvidence = '';
      if (request.objective.includes('CONTROLES_FICTIFS')) {
        const gap = await call('career_script', {
          command: 'jd-skill-gap',
          path: 'jds/offre.md',
        });
        controlEvidence = JSON.parse(gap.text).gap.join(',');
      }
      const id = randomUUID();
      await call('career_offer_save', {
        id,
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
