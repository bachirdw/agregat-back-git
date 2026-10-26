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
