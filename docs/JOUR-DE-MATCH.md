# Jour de match

Pour le régisseur : la checklist à imprimer, de la veille au soir jusqu'à la fin de la journée. Le détail de chaque panneau est dans [REGIE.md](REGIE.md).

## La veille
- [ ] **Équipes** : panneau **Équipes & Joueurs** → **+ Nouvelle équipe** (nom, TAG, couleur).
- [ ] **Logos** : **ASSETS** → « Logos équipes » ; puis clic sur l'en-tête de chaque équipe → menu logo → **Enregistrer**.
- [ ] **Joueurs** : `Pseudo#TAG` dans le champ **+** en bas de la colonne de chaque équipe ; import tracker.gg ([3 méthodes](REGIE.md#importer-les-joueurs-depuis-trackergg)). Rôle de chaque joueur. Les 5 premiers = titulaires.
- [ ] **Photos** (si tu en as) : **ASSETS** → « Photos joueurs » ; puis fiche du joueur → **Photo**.
- [ ] **Profils manquants** : panneau **Stats Joueur** → section **Profils manquants** vide (ou stats saisies à la main).
- [ ] **Host et casters** : panneau **Lower thirds** → **Host et casters** (rôle, nom, pseudo) → **Enregistrer** ; vérifie la répartition du **Plateau** (gauche / centre / droite).
- [ ] **Planning** : panneau **Écrans** → **Planning** (heures, équipes) → **Trier par heure**.
- [ ] **Infos tournoi** et textes des écrans : panneau **Écrans**.
- [ ] **Bracket** : panneau **Bracket & Groupes** (groupes, équipes, quarts).
- [ ] **Copie de sécurité** : panneau **Données** → **⬇ Exporter mes données**. Range le fichier hors du PC (clé USB, cloud).
- [ ] **Répétition complète** :
  1. Panneau **Données** → **3. Tester** → **Charger des données de test** (2 clics).
  2. Dans OBS, passe en revue chaque scène et chaque overlay depuis la **Régie** : **Bientôt**, **Pause**, **Fin**, **Planning**, **50/50 caméras**, versus, veto, maps, stats joueur, duel, groupes, bracket, lower thirds, ticker, **▶ LANCER LA TRANSITION**.
  3. Panneau **Données** → **2. Sauvegardes automatiques** → ligne « Avant les données de test » (la plus récente) → **Restaurer** (2 clics). Tes vraies données reviennent ; les overlays sont masqués.
  4. Vérifie que tes équipes, joueurs, planning et bracket sont bien revenus.

## Avant l'antenne
- [ ] Double-clic sur **`start.bat`** ; la régie s'ouvre. Laisse la fenêtre noire ouverte.
- [ ] Panneau **Données** → **5. Réglages** → **décoche** « Recharger automatiquement les overlays quand leur code change ».
- [ ] OBS ouvert, source `stream.html` visible, caméras en place (voir [OBS.md](OBS.md)).
- [ ] Panneau **Match** : **Phase**, **Format**, **Équipe A**, **Équipe B**.
- [ ] Panneau **Veto des maps** → **Paramètres du veto** : bon format (**BO1** / **BO3** / **BO5**), bonne équipe qui commence, bonnes **maps en rotation** ; relis l'ordre affiché.
- [ ] Panneau **Écrans** → **Compte à rebours** : **Lancer (minutes)** ou **Jusqu'à cette heure**.
- [ ] **Régie** → scène **Bientôt**.
- [ ] Ticker : messages à jour (panneau **Ticker défilant** → **Enregistrer le ticker**).

## Pendant un match
1. **Veto** : panneau **Veto des maps** → **AFFICHER** sur **Veto des maps** ; clique les maps au fil des bans et picks ; choisis les côtés (**… en ATTAQUE** / **… en DÉFENSE**).
   Ou laisse les équipes le faire : **Liens pour les équipes** → **Copier** le lien de chaque équipe et envoie-le-lui (même réseau que la régie). Tu peux toujours corriger depuis le panneau.
2. **Récap** : **AFFICHER** sur **Récap du veto**.
3. **Maps du match** : panneau **Match** → **Remplir depuis le veto** ; la map 1 doit porter le bouton doré **Map en cours** (sinon clique **Définir en cours** sur sa ligne).
4. **Versus** : **AFFICHER** sur **Versus** (Régie ou panneau Match).
5. **Agents** : panneau **Match** → **Agents joués par map** (map 1).
6. **Intro de map** : panneau **Maps & Transitions** → **Intro de map** (menu **Map** sur « Auto — map courante ») → **AFFICHER**.
7. **Retour au jeu** : **Régie** → **▶ LANCER LA TRANSITION** vers **Tout masquer · retour au jeu** (ou le bouton **Tout masquer · retour au jeu** sans transition).
8. **Pendant la map** : scores dans le tableau du panneau **Match** (**Score A**, **Score B**) ; lower thirds et ticker depuis la Régie ou les panneaux Lower thirds et Ticker.
9. **Fin de la map** : panneau **Match** → **Terminer** sur la ligne de la map (vainqueur selon le score).
   N'utilise **pas** en plus le **+1** du panneau Live pour la même map : il compterait une map de plus.
10. **Résultat** : panneau **Maps & Transitions** → **Résultat de map** (map en « Auto », choisis le **MVP**) → **AFFICHER**.
11. **Pause** : **Régie** → transition vers la scène **Pause** (relance le compte à rebours dans le panneau **Écrans** si besoin).
12. **Map suivante** : panneau **Match** → **Définir en cours** sur la map suivante, agents de cette map, puis reprends à l'étape 6.
13. **Fin du match** : mets à jour le **Planning** (statut **Terminé**, score) et le **Bracket** (scores, bouton **V**) : ils ne se remplissent pas tout seuls.

## Fin de journée
- [ ] Planning à jour (les matchs « Terminé » s'affichent sur l'écran de fin).
- [ ] **Régie** → scène **Fin**.
- [ ] Après la coupure du stream : panneau **Données** → **⬇ Exporter mes données**, fichier rangé hors du PC.
- [ ] Ferme la fenêtre noire de la régie.
