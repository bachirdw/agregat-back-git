// equipe-01 (lot E2) : mission_continuer, the method of Claude Code for a follow-up : the chief
// writes to the sub-mission that already has the context instead of launching a new one.
// - running : its message is handed over during its work by the owner-message brick
//   (engine.message : injected in the turn, or one more turn), marked `de: 'chef'` on its event ;
// - not started yet (queued, waiting for the owner or a prerequisite) : `pas_demarree` ;
// - ended (with success or not) : a suite, a new sub-mission linked by `famille.continue`, launched
//   through the path of `reprend` (same envelope counters, launch() of delegation.js), with the same
//   title « (suite n) », role, structured task, files, agent, model and results folder ; it gets
//   `famille.precedent` (the previous attempt's answer and files : data).
// The suite does not get the agent's session memory back (the adapters refuse to reload a
// session) : the continuity is the previous answer and files.
import { terminal } from '../storage/index.js';
import { CHIEF_MESSAGE_PREFIX } from './delegation-rule.js';

const fail = (erreur, message) => Object.assign(new Error(message), { erreur });

export async function continueChild(delegation, mother, control, args) {
  const children = delegation.childrenOf(mother);
  const child = children.find((run) => run.id === args.id);
  if (!child) throw fail('introuvable', `Aucune sous-mission de cette mission : ${args.id}`);
  if (!terminal.has(child.state)) {
    if (delegation.heldState(child.id) || !delegation.engine.active.has(child.id))
      throw fail('pas_demarree', 'Cette sous-mission n’a pas encore démarré : attends son départ.');
    if (args.agent !== undefined || args.modele !== undefined)
      throw fail(
        'parametres_invalides',
        'agent et modele ne s’appliquent qu’à la suite d’une sous-mission finie',
      );
    try {
      await delegation.engine.message(child.id, args.message, {
        de: 'chef',
        prefix: CHIEF_MESSAGE_PREFIX,
      });
    } catch (error) {
      throw fail('mission_terminee', String(error?.message ?? error));
    }
    return { id: child.id, etat: 'message_remis' };
  }
  // A suite : what the previous attempt was given, kept by the platform (in memory).
  const brief = delegation.briefs.get(child.id) ?? {};
  const result = await delegation.launch(mother, control, {
    consigne: args.message,
    continue: child.id,
    agent: args.agent ?? child.agent,
    ...(args.modele !== undefined
      ? { modele: args.modele }
      : args.agent === undefined || args.agent === child.agent
        ? { modele: child.model ?? '' }
        : {}),
    ...((child.famille?.role ?? brief.role?.nom)
      ? { role: child.famille?.role ?? brief.role.nom }
      : {}),
    ...(brief.fichiers?.length ? { fichiers: brief.fichiers } : {}),
    ...(brief.tache ?? {}),
  });
  return { ...result, suiteDe: child.id };
}

// The previous attempt given to a suite (data reported by it).
export function precedentOf(delegation, previous) {
  const { id, titre, etat, reponse, fichiers, verdict } = delegation.outcome(previous);
  return { id, titre, etat, reponse, fichiers, ...(verdict ? { verdict } : {}) };
}

// The title of a suite : the task's first title followed by « (suite n) ».
export function suiteTitle(first, n) {
  return `${first} (suite ${n})`;
}
