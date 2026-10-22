# OBS

Pour le régisseur : brancher les overlays dans OBS (source unique ou sources séparées), placer les caméras de l'écran 50/50, utiliser la transition en PNG et, si la régie est protégée par un mot de passe, l'URL avec clé.

## Une seule source : `stream.html`
```
http://localhost:9090/bundles/valorant-tournament/graphics/stream.html
```
Cette page contient **toutes** les couches, de bas en haut :
1. la scène de fond choisie dans la **Régie** (**Bientôt**, **Pause**, **Fin**, **Planning**, **50/50 caméras**), ou rien (**Jeu (aucune)**) : le jeu de ta scène OBS se voit alors en dessous ;
2. les overlays plein écran (versus, veto, maps, joueurs, groupes, bracket) ;
3. les overlays en jeu (lower thirds, ticker) ;
4. la transition, tout en haut.

Tout se pilote depuis la régie : tu n'as plus à changer de scène OBS pour passer de l'écran d'attente au jeu ou à la pause. Le fond de la page est transparent tant qu'aucune scène de fond n'est choisie.

### Mise en place
1. Dans ta scène OBS de jeu, ajoute une source **Navigateur** au-dessus de la capture du jeu et des caméras.
2. URL : celle ci-dessus (ou copie-la : panneau **Régie** → **URLs pour OBS** → ligne « ★ STREAM » → **Copier**).
3. Réglages de la source :
   | Réglage | Valeur | Pourquoi |
   |---|---|---|
   | Largeur × hauteur | **1920 × 1080** | Tous les overlays sont dessinés pour cette taille. |
   | Arrêt de la source quand elle n'est pas visible | **décoché** | Sinon la page est coupée puis rechargée : ce qui était à l'antenne disparaît ou rejoue son entrée. |
   | Actualisation du navigateur quand la scène devient active | **décoché** | Même raison : chaque changement de scène OBS rechargerait tous les overlays. |
   | Fréquence d'images | celle de ton stream (ex. 60) | Animations fluides. |
4. Si tu as plusieurs scènes OBS, réutilise **la même** source dans chacune (pas une copie) : une seule page tourne, son état reste le même partout.

Rien d'autre à régler : la page n'émet aucun son.

## Sources séparées (facultatif)
Chaque overlay existe aussi seul : `http://localhost:9090/bundles/valorant-tournament/graphics/<fichier>` (liste dans le [README](../README.md#les-overlays), URLs à copier dans **Régie** → **URLs pour OBS**). Mêmes réglages de source que ci-dessus.

À savoir si tu choisis cette méthode :
- Les écrans de fond (`starting.html`, `brb.html`, `ending.html`, `schedule.html`, `dual-cam.html`) s'affichent **en permanence** : les boutons de scène de la Régie ne pilotent que `stream.html`. C'est à toi de les montrer ou cacher dans OBS.
- Les autres overlays apparaissent et disparaissent seuls, avec les boutons **AFFICHER** de la régie.
- `transition.html` doit être tout en haut de la scène.

## Écran 50/50 : placer les caméras
La scène **50/50 caméras** (Régie) affiche un habillage percé de deux trous transparents. Place tes deux sources caméra **sous** `stream.html`, chacune dans son trou (coordonnées sur un canevas 1920×1080) :

| Trou | Position x | Position y | Taille |
|---|---|---|---|
| Gauche | 40 | 220 | 896 × 504 |
| Droite | 984 | 220 | 896 × 504 |

Les trous sont au format **16:9**, comme une caméra : redimensionne chaque source à 896 × 504 (clic droit → **Transformer** → **Modifier la transformation**, ou 46,67 % d'une caméra 1080p), sans recadrage. Ils ont deux coins coupés (haut-gauche et bas-droit) qui masquent un petit triangle de l'image. Ces coordonnées sont aussi affichées dans le panneau **Écran 50/50 (dual-cam)**.

## La transition (stinger)
Avec `stream.html`, la transition est déjà dans la page : le bouton **▶ LANCER LA TRANSITION** de la Régie la joue et fait le changement demandé (**2. Vers**) au moment où l'écran est entièrement couvert. Rien à faire dans OBS.

Pour utiliser plutôt la transition « Stinger » d'OBS (ou dans un logiciel de montage), exporte-la en images PNG :
1. Régie lancée, panneau **Maps & Transitions** → carte **Exporter en séquence PNG**.
2. **Exporter (logo)**, **Exporter + map choisie** (la map choisie dans le menu sous l'aperçu) ou **Exporter (replay)**. Une barre montre la progression.
3. Résultat dans le dossier `exports/` du projet : `exports/stinger/` (logo seul), `exports/stinger-<map>/` (ex. `exports/stinger-ascent/`) ou `exports/stinger-replay/`, images `frame_0001.png`, `frame_0002.png`… en 1920×1080, 60 images/s, fond transparent.
4. Le fichier `info.txt` du dossier donne la durée, le **point de coupe conseillé** (en millisecondes et en numéro d'image) et deux commandes `ffmpeg` pour assembler les images en vidéo avec transparence (OBS a besoin d'une vidéo pour un stinger).
5. Dans OBS, crée une transition Stinger avec cette vidéo et règle son point de transition sur la valeur d'`info.txt`.

Attention : un nouvel export **remplace** le dossier du même nom. Renomme un dossier pour le garder.
Même chose en ligne de commande, serveur lancé : `npm run export:stinger` (logo), `npm run export:stinger -- --map Ascent` ou `npm run export:stinger -- --replay`.
L'export a besoin de Chrome, Edge ou Firefox sur le PC (peu importe le navigateur où la régie est ouverte) : il ne fonctionne que sur la régie locale, pas sur une régie en ligne.

## Régie protégée par un mot de passe
Quand la régie a un mot de passe (`start-reseau.bat` avec mot de passe, ou régie en ligne), OBS ne peut pas se connecter avec un identifiant : il utilise la **clé** de la régie.
1. Connecte-toi à la régie, puis ouvre la page **SETTINGS** de NodeCG (en haut à droite, après **ASSETS** ; elle n'apparaît que si un mot de passe est activé).
2. Carte **Your Key** → **Copy Key**.
3. URL de la source OBS : `…/bundles/valorant-tournament/graphics/stream.html?key=TA_CLE`
   (ex. en ligne : `https://regie.tondomaine.fr/bundles/valorant-tournament/graphics/stream.html?key=TA_CLE`).

Cette clé donne un **accès complet** à la régie : traite-la comme un mot de passe, ne la montre jamais à l'écran. Le bouton **Reset Key** de la même page en crée une nouvelle (l'ancienne cesse de marcher : mets à jour l'URL dans OBS). Détails : [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Version d'OBS
Reste sur **OBS 32.x** pour le tournoi. OBS 33 (en bêta au 1er octobre 2026) change le moteur de rendu de ses sources navigateur (Chromium 127 → 150) : ne mets pas à jour sans avoir tout retesté (chaque overlay, la transition, l'écran 50/50).
