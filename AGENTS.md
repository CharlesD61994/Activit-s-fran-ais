# Guide agent — Alinéa - Activités de français

Ce fichier sert de contexte durable pour les futures conversations Codex. Le code courant est toujours la source de vérité : si ce guide contredit le dépôt, inspecter le dépôt et corriger le guide.

## Objectif du projet

Alinéa est une application Next.js/React pour créer, assigner et présenter des activités de français au tableau ou aux élèves : activités grammaticales, analyses en arbre et feuilles d’activité imprimables/interactives.

L’application doit permettre au créateur de préparer du matériel pédagogique visuel, puis au lecteur d’afficher une expérience simple et stable. Les activités peuvent aussi être imprimées en corrigé ou en version élève.

## Architecture générale

- Framework : Next.js 15, React 19, TypeScript.
- État principal : `src/store/app-store.tsx`.
- Modèle central : `Sentence` dans `src/types/index.ts`. Même les activités non strictement “phrase” sont stockées comme `Sentence`.
- Persistance :
  - locale : `src/lib/storage.ts` et `src/lib/repository/local-repository.ts`;
  - Supabase optionnel : `src/lib/repository/supabase-repository.ts`;
  - `createRepository()` choisit Supabase seulement si l’environnement est configuré et l’utilisateur authentifié.
- Données de départ : `src/data/demo-data.ts`.
- Styles globaux : `src/app/globals.css`. Beaucoup de comportements de mise en page, lecteur, impression et éditeur y sont centralisés.

## Modules principaux

### Activités pédagogiques / grammaire mixte

- Éditeur : `src/components/mixed-activity-editor.tsx`.
- Lecteurs associés :
  - `src/components/presentation/interactive-sentence-reader.tsx`;
  - `src/components/presentation/word-class-reader.tsx`;
  - `src/components/presentation/word-group-reader.tsx`;
  - `src/components/presentation/grammar-extension-reader.tsx`;
  - `src/components/presentation/correction-pause.tsx`;
  - `src/components/presentation/correction-print-sheet.tsx`.
- Helpers partagés :
  - `src/lib/grammar-workflow.ts`;
  - `src/lib/grammar-interactions.ts`;
  - `src/lib/word-class-relations.ts`;
  - `src/lib/word-group-utils.ts`;
  - `src/lib/mixed-activity-adapter.ts`;
  - `src/lib/french-typography.ts`;
  - `src/components/grammar/*`.

Le module mixte orchestre plusieurs mécaniques dans une seule phrase/surface : corrections, classes de mots, groupes, fonctions, noyaux, donneurs/receveurs, genre et nombre. Ne pas recréer un lecteur ou une modale séparée pour une mécanique qui existe déjà : factoriser ou réutiliser.

### Analyse en arbre

- Éditeur : `src/components/tree-analysis-editor.tsx`.
- Lecteur : `src/components/presentation/tree-analysis-reader.tsx`.
- Ce module reste à part. Il possède ses propres besoins : page, rectangles, arbres, tableaux, interactions liées aux arbres, impression de documents d’analyse.
- Ne pas fusionner de force l’arbre dans le module mixte. On peut partager des utilitaires, mais le comportement d’arbre demeure distinct.

### Feuille d’activité

- Éditeur : `src/components/worksheet-editor.tsx`.
- Lecteur : `src/components/presentation/worksheet-reader.tsx`.
- La feuille d’activité reprend les éléments de document pédagogique sans les mécaniques d’arbre :
  - pages portrait;
  - entête Nom/Groupe/page;
  - grand bandeau gris;
  - total;
  - bloc “Ta tâche”;
  - texte;
  - points `/x`;
  - tableaux;
  - grilles de notation;
  - numéros;
  - lignes de réponse;
  - bandeaux de lecture;
  - images;
  - cases à cocher.
- Le lecteur doit permettre de révéler les réponses ligne par ligne ou cellule par cellule, sans ordre imposé.

### Portails et banque

- La banque d’activités affiche les activités avec niveau, difficulté, type et tags.
- Les portails groupe/élève utilisent les points, objectifs hebdomadaires, cartes d’activité, séances et compétitions.
- Les types visibles doivent rester cohérents avec les tags/objectifs stockés dans `Sentence`.

## Modèle de données à respecter

`Sentence` contient plusieurs familles de champs. Les plus sensibles :

- `activityType` : `"sentence_correction"`, `"text_correction"`, `"word_classes"`, `"word_groups"`, `"tree_analysis"`, `"worksheet"`.
- `isMixedActivity`, `primaryObjective`, `workflowPhases`, `grammarAnnotations` : orchestration des activités grammaticales.
- `corrections`, `wordClassTargets`, `wordGroupTargets`, `agreementRelations`, `agreementCorrectionArrows` : réponses grammaticales.
- `treeAnalysis*` : données de page/document/arbre/tableau/texte. Certaines sont aussi réutilisées par Feuille d’activité.
- `worksheetAnswerLines`, `worksheetCheckBoxes`, `worksheetDimensionBands`, `worksheetImages`, `worksheetReaderOrder` : éléments propres à Feuille d’activité.

Ne pas supprimer les champs “legacy” sans migration. `src/lib/storage.ts` lit encore une clé historique `phrase-du-jour-v21` pour migrer les anciennes données vers `alinea-activites-francais-v21`.

## Invariants importants

- Nom produit : utiliser “Alinéa - Activités de français”. Éviter de réintroduire “Phrase du jour” sauf pour compatibilité/migration interne.
- Une action interactive vaut 1 point dans les activités mixtes et les arbres.
- Le lecteur mixte doit garder la même phrase/surface entre les phases. Les annotations déjà réussies restent visibles quand on passe à l’étape suivante.
- Les mécaniques existantes doivent être réutilisées : corrections, classes, groupes, fonctions, noyaux, donneurs/receveurs, genre/nombre. Ne pas reconstruire une version parallèle “vite faite”.
- Les crochets et encadrements ne doivent pas fusionner quand deux groupes sont adjacents.
- Les labels de groupes, classes, codes, fonctions et genre/nombre doivent rester à des distances cohérentes de leur mot ou segment.
- Les mots ne doivent pas changer de ligne quand on révèle des crochets, cadres ou codes. Prévoir l’espace visuel à l’avance.
- Ne jamais laisser une élision française seule en fin de ligne (`l’`, `d’`, `qu’`, etc.). Utiliser les helpers de `src/lib/french-typography.ts`.
- Dans Feuille d’activité, l’impression doit contenir toutes les pages dans l’ordre.
- Les lignes, tableaux, grilles et entêtes doivent imprimer avec des traits fins et réguliers, sans doubles bordures ni contours fantômes.
- Le corrigé imprimé doit représenter l’état final attendu, pas une recomposition approximative qui diffère du lecteur/éditeur.
- Les menus sticky de Feuille d’activité doivent rester compacts, opaques et proches les uns des autres sans masquer le contenu.

## Zones à risque de régression

- Mise en page texte + annotations : retours de ligne, interligne, crochets, cadres, codes, labels.
- Donneurs/receveurs : désactiver “demander le rôle” ne doit pas bloquer la fin d’activité ni les actions liées classe/genre/nombre.
- Flèches d’accord : les traits dessinés par l’enseignant ou l’élève doivent conserver leur géométrie quand la phrase est rendue ou imprimée.
- Impression : les styles `@media print` dans `src/app/globals.css` peuvent diverger de l’éditeur. Tester les pages blanches, l’orientation, les traits trop épais et les éléments manquants.
- Feuille d’activité : plusieurs éléments partagent des structures `treeAnalysis*`; attention à ne pas casser Analyse en arbre en corrigeant Feuille d’activité.
- Tableaux et grilles : alignement vertical, bordures, fusion/séparation de cellules, réponses interactives.
- Images dans les textes : l’habillage doit rester visuellement stable dans l’éditeur et à l’impression.
- Tags et filtres : les tags personnalisés de Feuille d’activité doivent être conservés dans `Sentence.tags` et filtrables dans la banque.
- Migration/localStorage : ne pas changer `DATA_VERSION` ou les clés sans stratégie de migration.

## Conventions de travail

- Avant de modifier une mécanique, chercher d’abord un helper ou un lecteur existant.
- Préférer une correction centralisée à un patch CSS/composant local qui crée une exception.
- Garder les composants de présentation visuellement uniformes : mêmes espacements, mêmes boutons, mêmes barres d’outils pour actions similaires.
- Ne pas supprimer le code lié à Supabase : il est prévu pour plus tard, même si l’app fonctionne localement.
- Préserver les données utilisateur et les changements non liés dans le dépôt.

## Vérifications après modification

Minimum avant livraison :

```bash
npm run build
git diff --check
```

Selon la zone touchée :

- Helpers de grammaire/typographie : lancer les tests ciblés ou `npm run test`.
- Lecteur mixte : tester une activité avec phases enchaînées, donneur/receveur, classe, genre/nombre et fin d’activité.
- Feuille d’activité : tester aperçu élève, corrigé, impression toutes pages, réponses révélables, tableaux, lignes et grilles.
- Arbre : tester le déplacement/édition, les rectangles, les interactions et le lecteur si un fichier partagé a été modifié.
- CSS/layout : vérifier visuellement les pages concernées, pas seulement le build.

Si une correction d’impression est nécessaire, comparer explicitement éditeur, lecteur et aperçu d’impression. L’objectif est la cohérence visuelle, pas seulement l’absence d’erreur.
