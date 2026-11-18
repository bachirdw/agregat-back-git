// chef-01 (mode workflow, décision du propriétaire du 18/11) : every text the platform sends to the
// agents of a family (the chief's sentence, the sub-mission's sentence, the end-of-turn reminder and
// the descriptions of the mission tools) is written here only, the same for every agent : no agent
// name, no tool of an agent, no branch on the agent's identity. They inform ; they oblige to nothing.
import { z } from 'zod';

// Name of the MCP server that lends the mission tools to the chief.
export const MISSION_SERVER = 'relay-missions';
// The owner's envelope when the request gives no number (conception 18/11, question 2).
export const DEFAULT_ENVELOPE = Object.freeze({ total: 10, parallel: 3 });
// Same ceiling as the DAG engine (packages/workflow-engine/definition.js).
export const MAX_PARALLEL = 8;
export const MAX_TOTAL = 200;
// Sub-missions the owner is asked to add when the chief reaches the envelope.
export const ENVELOPE_EXTENSION = 5;
// Longest wait of one mission_attendre call, and its default (short and repeated works everywhere).
// delegation-v2-01 (plan v2, Codex 3) : 50 s at most, whatever delaiSecondes asks, for every agent
// (an MCP client may stop a tool call after 60 s) ; the chief calls again to wait longer.
export const MAX_WAIT_SECONDS = 50;
export const DEFAULT_WAIT_SECONDS = 50;
export const waitSeconds = (asked) =>
  Math.min(MAX_WAIT_SECONDS, Math.max(1, Number(asked) || DEFAULT_WAIT_SECONDS));

export function chiefRule({ total, parallel }) {
  return `Mode workflow accepté par le propriétaire : tu peux confier des parties de la mission à des sous-missions avec les outils mission_lancer, mission_suivre, mission_attendre et mission_annuler ; chacune est une mission complète, avec ses questions au propriétaire et ses cartes d’envoi ; tu reçois sa réponse et son Bilan ; jusqu’à ${total} sous-missions, ${parallel} à la fois.`;
}

export const DAUGHTER_RULE =
  'Tu es une sous-mission lancée par l’agent chef d’une mission du propriétaire. La demande du propriétaire, jointe, prime ; ta consigne est la partie qui t’est confiée. Ta réponse finale est rendue au chef. Tes questions au propriétaire et tes cartes d’envoi lui arrivent directement. D’autres sous-missions peuvent travailler en même temps dans le même espace.';

// The one more turn given to a chief whose sub-missions still run when its turn ends.
export function familyReminder(titles) {
  const named = titles.map((title) => `« ${title} »`).join(', ');
  return `Tes sous-missions ${named} sont encore en cours : attends-les avec mission_attendre ou annule-les avec mission_annuler, puis termine. Ta réponse de ce tour remplace la précédente : reprends-y l’essentiel de ce qui a été fait.`;
}

const id = z.string().uuid();
// The four tools of the first sprint (mission_preciser comes with the next one).
export const MISSION_TOOLS = {
  mission_lancer: {
    description:
      'Confie une partie de la mission à une sous-mission, mission complète de la plateforme, et rend la main tout de suite avec son identifiant. Au-delà des sous-missions permises en même temps, elle attend sa place (etat en_file) et démarre seule. consigne : ce que la sous-mission doit faire ; titre : libellé montré au propriétaire ; agent et modele : par défaut ceux de la mission mère (agents installés et modèles qu’ils annoncent : voir mission_suivre) ; fichiers : chemins de l’espace que la sous-mission lit d’abord.',
    schema: z
      .object({
        consigne: z.string().trim().min(1).max(8000),
        titre: z.string().trim().min(1).max(80).optional(),
        agent: z.string().trim().min(1).max(40).optional(),
        modele: z.string().trim().max(200).optional(),
        fichiers: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
      })
      .strict(),
  },
  mission_suivre: {
    description:
      'Où en sont tes sous-missions (sans id : toutes) : état, depuis combien de secondes, ce qu’elles attendent, outils appelés ; avec details et une sous-mission finie, sa réponse, son Bilan, ses fichiers et ses envois. Donne aussi les agents installés sur la machine avec les modèles que chacun annonce, et le nombre d’agents en activité sur la machine (missions et sous-agents), dont ceux en attente du propriétaire.',
    schema: z
      .object({
        id: id.optional(),
        details: z.boolean().default(false),
      })
      .strict(),
  },
  mission_attendre: {
    description: `Attend la fin de sous-missions (ids ; sans ids : toutes) et rend à chaque appel l’état de toutes celles demandées : celles finies (terminees, avec réponse, Bilan, fichiers et envois) et celles en cours (enCours). toutes=false rend la main dès qu’une de celles en cours finit, toutes=true quand toutes ont fini. Un appel attend au plus ${MAX_WAIT_SECONDS} secondes (delaiSecondes peut être plus court) puis rend ce qui est fini et ce qui tourne encore (delaiAtteint) : rappelle-le pour attendre plus longtemps. Rien n’est consommé : les résultats se relisent autant de fois que nécessaire, ici ou par mission_suivre avec details.`,
    schema: z
      .object({
        ids: z.array(id).min(1).max(50).optional(),
        toutes: z.boolean().default(false),
        // Any number is taken : the platform waits waitSeconds() of it.
        delaiSecondes: z.number().int().min(1).default(DEFAULT_WAIT_SECONDS),
      })
      .strict(),
  },
  mission_annuler: {
    description:
      'Arrête une de tes sous-missions (ses questions sont fermées, sa carte d’envoi ouverte est refusée). Une sous-mission déjà finie rend son état.',
    schema: z
      .object({
        id,
        raison: z.string().trim().max(500).optional(),
      })
      .strict(),
  },
};
