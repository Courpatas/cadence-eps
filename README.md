# Cadence EPS

Application web pour iPad qui mesure la fréquence de course d'un élève (pas par minute) en le filmant de profil.

## Comment ça marche

1. Le modèle MediaPipe Pose repère sur chaque image les hanches, les genoux et les chevilles de l'élève.
2. L'application suit l'écart horizontal entre les deux chevilles, divisé par la longueur de jambe. Cet écart est maximal à chaque appui au sol.
3. Une autocorrélation sur les 3 dernières secondes donne la période d'un pas, donc la fréquence : 60 / période.

Testé sur des courses simulées de 130 à 250 pas/min, avec bruit, asymétrie et perte momentanée du coureur : l'écart est inférieur à 1,5 pas/min.

## Sur le terrain

- iPad **fixe** (pied ou appui), en paysage, **de profil** par rapport au couloir, à 6–10 m.
- L'élève doit être visible **de la tête aux pieds** pendant au moins 2 s, soit 4 à 6 appuis.
- Saisir le prénom, appuyer sur **Mesurer un passage** avant que l'élève entre dans le champ. La mesure s'arrête seule quand il sort.
- Chaque résultat indique une fiabilité (bonne / moyenne / faible). Refaire le passage si elle est faible.
- **Exporter (CSV)** produit un fichier lisible dans Excel ou Numbers.
- **Analyser une vidéo** : choisir une vidéo filmée normalement (pas en mode « Ralenti » de l'iPad).

Les résultats restent enregistrés sur l'iPad, dans Safari. Ils ne sont envoyés nulle part.

## Mise en ligne (obligatoire pour la caméra)

Safari n'autorise la caméra que sur une page en **https**. Avec GitHub Pages, gratuit :

1. Créer un dépôt public sur github.com, par exemple `cadence-eps`.
2. Y déposer `index.html` et `cadence.js` (bouton *Add file › Upload files*).
3. *Settings › Pages* : Source = *Deploy from a branch*, branche `main`, dossier `/ (root)`.
4. Après une minute, l'app est en ligne à `https://<votre-compte>.github.io/cadence-eps/`.
5. Sur l'iPad, ouvrir cette adresse dans Safari, puis *Partager › Sur l'écran d'accueil*.

Une connexion Internet est nécessaire au premier lancement, pour télécharger le modèle (environ 6 Mo).

## Fichiers

- `index.html` : l'interface, la caméra et la détection.
- `cadence.js` : le calcul de la fréquence (sans dépendance, testable seul).
