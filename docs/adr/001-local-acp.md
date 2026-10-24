# ADR 001 — Monolithe local et ACP stable
Statut : accepté pour MVP, 2026-10-24.

Choisir Node 24 ESM, SDK ACP stable v1 et adaptateurs upstream Codex/Claude ; Gemini via ACP natif détecté. SQLite natif Node pour durabilité, SSE pour suivi. JS évite chaîne de compilation ; validation Zod aux frontières. Modules internes du monorepo sans paquets publiés artificiels.

Rejetés : parsing tmux (CAO) pour le chemin principal, réécriture de wrappers CLI fournisseur, fork des projets sans besoin démontré, microservices. acpx est adapté aux sessions/flows avancés mais ajoute un second stockage de sessions et une API pré-1.0 ; différé tant que notre workflow est une recette unique séquentielle. SDK officiel réutilisé pour tout transport/protocole.

Conséquences : négociation de capacités obligatoire, tests avec vrai transport ACP et agent fixture, validation live séparée. Pas de promesse d'isolation OS ou de compatibilité avec toutes les versions CLI.
