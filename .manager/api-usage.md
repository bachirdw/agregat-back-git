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
