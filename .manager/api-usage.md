# Journal des appels API payants

| Heure | Session | Modèle | But | Tokens in/out | Coût estimé | Cumul |
|---|---|---|---|---|---|---|
| 02:47 | manager | gemini-3.5-flash-lite | Test de la clé (« OK ») | 5 / 1 | < 0,0001 $ | < 0,0001 $ (1 appel) |
| 03:05 | live-probe | gemini-3.5-flash-lite | Prompt ACP « OK » via Gemini CLI | 10451 / 1 (+187 réflexion) | ≈ 0,002 $ (hypothèse prudente ≤ 0,20 $/M entrée, prompt système du CLI inclus) | ≈ 0,002 $ (2 appels) |
| 03:09 | manager sprint-02 | gemini-3.5-flash-lite | Run réel Najah n°1 (MCP ignoré : dossier non approuvé) | ≈ 35 000 / < 1 000 (3 tours) | ≈ 0,008 $ | ≈ 0,010 $ (5 appels) |
| 03:10 | manager sprint-02 | gemini-3.5-flash-lite | Run réel Najah n°2 (permissions refusées par bug d’affichage) | ≈ 37 000 / < 1 000 (3 tours) | ≈ 0,008 $ | ≈ 0,018 $ (8 appels) |
| 03:12 | manager sprint-02 | gemini-3.5-flash-lite | Run réel Najah n°3 — **completed** | ≈ 25 000 / < 1 000 (2–3 tours) | ≈ 0,006 $ | ≈ 0,024 $ (11 appels) |

Note manager 03:13 : un « appel » = un tour de modèle. Les runs agents coûtent plusieurs tours (~12 000 tokens
de prompt système Gemini CLI par tour). Plafond des appels relevé à **200** ; le plafond en dollars (2 $) reste
la contrainte principale, très en dessous de la limite absolue de 10 $.
| 04:08 | manager sprint-03 | gemini-3.5-flash-lite | Workflow DAG Najah réel (étape analysis) — **completed** | ≈ 13 000 / ≈ 100 (1 tour) | ≈ 0,003 $ | ≈ 0,027 $ (12 appels) |

Note 03:58 : les heures des lignes « manager » ci-dessus après 03:05 sont estimées (en avance) ; les montants restent exacts.
| 04:40 | manager sprint-06 | gemini-3.5-flash-lite | DAG Najah live n°1 (vraies sources) — completed | ≈ 15 000 / ≈ 300 (1 tour) | ≈ 0,004 $ | ≈ 0,031 $ (13 appels) |
| 04:47 | manager sprint-06 | gemini-3.5-flash-lite | DAG Najah live n°2 après correctifs — completed | ≈ 18 000 / ≈ 300 (1 tour) | ≈ 0,004 $ | ≈ 0,035 $ (14 appels) |
| 04:42 | manager | gemini-3.5-flash-lite | Tests de reprise de session (4 tours, dont 2 réussis + diagnostic) | ≈ 42 000 / < 20 | ≈ 0,009 $ | ≈ 0,044 $ (18 appels) |
| 14:25 | career-ops-01 | gemini-2.5-flash-lite | REST « OK », échec ; session ACP sans inférence | inconnu / inconnu | ≤ 0.010000 $ | ≤ 0.054000 $ (19 appels) |
| 14:26 | career-ops-01 | gemini-3.1-flash-lite | REST « OK », réussi ; session ACP sans inférence | 4 / 2 | ≤ 0.000001 $ | ≤ 0.054001 $ (20 appels) |

Correction du tarif du smoke 14:26 : le calcul utilisait encore le tarif 2.5 après passage à 3.1.
Source officielle : https://ai.google.dev/gemini-api/docs/pricing.md (0,25 / 1,50 USD/M).
| 14:27 | career-ops-01 | gemini-3.1-flash-lite | Correction comptable du même appel REST, aucun nouvel appel | 4 / 2 | ≤ 0.000004 $ | ≤ 0.054004 $ (20 appels) |
| 14:47 | mission utilisateur career-ops (Gemini CLI, clé API) | gemini-3.1-flash-lite | Analyse CV + recherche Remotive, 2 offres | 694 031 / 11 285 | ≈ 0.190 $ | ≈ 0.244 $ |
| 15:05 | test manager career-ops (scan Seek + LinkedIn/Indeed + 5 évaluations) | gemini-3.1-flash-lite | Mission réelle, rien envoyé | 1 196 063 / 30 774 | ≈ 0.345 $ | ≈ 0.589 $ |
Tokens relevés dans les sessions Gemini (`relay/agent-home/.gemini/.../chats/*.jsonl`), tarif 0,25 / 1,50 USD/M.
Une mission career-ops coûte ≈ 0,2–0,35 $ (contexte relu à chaque tour) : plafond opérationnel 2 $ à surveiller.
| 15:35 | étape 1 utilisateur (échec : Gemini figé après 4 min, délai prompt 10 min) | gemini-3.1-flash-lite | scan + recherches web, aucune offre enregistrée | 378 914 / 9 860 | ≈ 0.110 $ | ≈ 0.80 $ (avec intake ≈ 0,1 $) |
| 15:48 | étape 1 relancée (consigne stricte) | gemini-3.1-flash-lite | scan Seek + 3 recherches web, 10 offres notées | 1610057 / 71805 | ≈ 0.5102 $ | ≈ 1.31 $ |

## Relevé du 26/10, 22:05 (manager Claude) — total réel de la journée
Tokens relus dans `relay/agent-home/.gemini/tmp/agregat-career-ops/chats/session-2026-10-26*.jsonl` (champ `tokens` : input inclut le cache ; thoughts facturés comme sortie). Tarifs : 3.5-flash-lite 0,30/2,50 ; 3.8-flash 0,75/3,75 (promo jusqu'au 31/12/2026) ; cache estimé à 10 % du tarif d'entrée.
| Session (UTC) | Modèle réellement servi | Entrée (dont cache) | Sortie+pensées | Coût estimé |
|---|---|---|---|---|
| 03:47 → 04:35 (5 sessions) | gemini-3.5-flash-lite | 3,17 M (2,02 M) | 65 k | ≈ 0,56 $ |
| 04:46 c6aa578f (Lookahead, non relevée jusqu'ici) | gemini-3.5-flash-lite | 6,24 M (4,41 M) | 93 k | ≈ 0,91 $ |
| 09:01 3d7b21ff (missions Seek 212d4ade, de1850a2, d7ba9058) | gemini-3.8-flash | 14,61 M (12,98 M) | 62 k | ≈ 2,43 $ |
**Total du jour ≈ 3,90 $ (+ ≈ 0,05 $ d'appels REST de test) sur le plafond opérationnel de 5 $.**
ANOMALIE : toutes les missions de l'après-midi enregistrées « gemini-3.1-flash-lite » ont été servies par gemini-3.5-flash-lite (modèle non annoncé par le probe ; le CLI a substitué). À corriger : le modèle enregistré doit être le modèle réellement servi.
Coût dominé par la relecture du contexte (≈ 78 k jetons par tour, 187 tours sur une session reprise 3 fois). AUCUNE nouvelle mission Gemini sans accord explicite de l'utilisateur (reste ≈ 1 $).
