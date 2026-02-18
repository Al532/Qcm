# Qcm

## Format des données (`data/*.json`)

Chaque quiz contient un tableau `questions`.

- `type` peut valoir uniquement :
  - `single` (optionnel / valeur par défaut) : une seule bonne réponse.
  - `multiple` : plusieurs bonnes réponses.
- Les médias (image/audio) ne définissent pas le type de question.
  - Dans l'intitulé : `promptMedia`.
  - Dans une réponse : `choices[].media`.
  - Format média : `{ "kind": "image"|"audio", "src": "...", "alt": "..." }`.

## Index des quiz

L'accueil ne pointe plus vers les fichiers JSON directement.
Il charge `data/quizzes.json` et génère un lien de page pour chaque slug (`/v/video.html?slug=...`).
