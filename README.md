# Activités de français — Livraison 68

## Lecteur Groupes de mots : crochets dessinés

Cette livraison ajoute la première phase interactive du lecteur.

### Dessin

L’élève trace directement `[` ou `]` avec :

- la souris;
- un stylet;
- le doigt sur un écran tactile.

Le tracé est affiché temporairement sur la phrase pendant le geste.

### Reconnaissance

Le lecteur analyse :

- la hauteur et la largeur du geste;
- la position de la tige verticale;
- l’orientation générale du crochet;
- la position du geste par rapport à la limite attendue du groupe.

Il distingue donc un crochet gauche `[` d’un crochet droit `]` sans exiger un
dessin parfaitement régulier.

### Validation indépendante

Les deux crochets sont deux réponses séparées.

- bon `[` : 1 point et le vrai caractère `[` reste dans la phrase;
- bon `]` : 1 point et le vrai caractère `]` reste dans la phrase;
- mauvais crochet : aucun point et le tracé disparaît;
- un crochet déjà trouvé reste affiché même si l’autre est faux.

### Plusieurs groupes

Pour cette livraison de test, lorsque les deux crochets d’un groupe sont
trouvés, le lecteur passe au groupe configuré suivant.

La V69 remplacera ce passage immédiat par :

1. identification du type de groupe lorsqu’elle est nécessaire;
2. clic sur le noyau;
3. passage au groupe suivant.

### Persistance

Les crochets trouvés et le groupe courant sont sauvegardés dans la progression
du lecteur. Quitter puis revenir conserve donc les crochets déjà validés.

## GitHub

```bash
git add .
git commit -m "feat: draw and recognize word group brackets"
git push
```
