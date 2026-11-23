# Ego Calculo

Calculatrice responsive en français, sans installation ni dépendance.

## Lancer le projet

Ouvrez `index.html` dans un navigateur. Pour utiliser un serveur local :

```powershell
cd "Ego Calculo"
python -m http.server 8000
```

Puis ouvrez <http://localhost:8000>.

## Utilisation

- Dans le bloc calculatrice à droite, choisissez **Matrices** : les opérations et les matrices apparaissent dans le panneau de gauche.
- Réglez le nombre de lignes et de colonnes de A et B, puis entrez les valeurs dans les cellules avec le pavé de la calculatrice ou le clavier.
- Utilisez les flèches du pavé ou les touches directionnelles pour passer d'une cellule à l'autre. En fin de matrice A, la flèche droite passe à la première cellule de B.
- Choisissez l'opération : somme, soustraction, produit matriciel, division `A ÷ B` (`A × B⁻¹`), multiplication par un scalaire, déterminant ou inverse de A ou B. Le résultat apparaît à gauche et se met à jour en direct.
- Choisissez **Calculatrice** dans le bloc pour retrouver les opérations usuelles : addition, soustraction, multiplication, division, pourcentage et signe.

Les matrices sont réglables de 1 × 1 à 6 × 6. Les opérations incompatibles, les matrices non carrées et les matrices singulières sont signalées.

## Fonctionnalités

- Interface adaptative pour ordinateur, tablette et mobile.
- Décor futuriste avec constellations Orion et Sirius, panneaux translucides en perspective 3D, sphère filaire animée (12 anneaux verticaux, 6 horizontaux et cœur lumineux, inspirée du rendu de `MesArticles.css`) et emplacement réservé pour la photo de profil.
- Intro de démarrage animée de 8 secondes avec calculatrice, nom Ego et sphère, possibilité de la passer et prise en compte de la réduction des animations.
- Apparition progressive des panneaux au défilement, animation lors du changement de mode, bio transparente révélée au scroll et pointeur circulaire fluide.
