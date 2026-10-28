// Liste des overlays pilotables et des scènes de fond, commune aux panneaux (KBO, Régie) et au serveur (API Companion).
// UMD : window.KBOList dans les pages (<script src="../shared/overlay-list.js"></script>, avant overlays.js),
// require('../shared/overlay-list.js') côté serveur. Uniquement des données : l'affichage (précisions, boutons) est dans overlays.js.
//
//   KBOList.ITEMS    [{ id, label, group, rep, path, fullscreen?, needs?(v) }]
//                    id = nom du fichier dans graphics/ (les trois lower thirds partagent lower-third.html)
//                    rep + path = booléen de visibilité dans le replicant (déclarés dans extension/*.js)
//                    fullscreen = écran plein qui doit être seul à l'antenne ; needs(v) = faux si l'overlay n'a rien à afficher
//   KBOList.item(id) entrée de la liste (ou null)
//   KBOList.SCENES   [[id, libellé]] scènes de fond de graphics/stream.html (replicant streamScene.scene)
//   KBOList.STINGER_DEFAULT  valeur par défaut du replicant fullscreenStinger : { enabled } — si actif, afficher / masquer
//                    un plein écran passe par la transition (stinger), le changement étant fait au point de coupe
(function (root) {
	const KBOList = {};

	KBOList.ITEMS = [
		{ id: 'lower-third-left', label: 'Lower third gauche', group: 'En jeu (transparent)', rep: 'liveLowerThird', path: ['left', 'visible'] },
		{ id: 'lower-third-center', label: 'Lower third centre', group: 'En jeu (transparent)', rep: 'liveLowerThird', path: ['center', 'visible'] },
		{ id: 'lower-third-right', label: 'Lower third droite', group: 'En jeu (transparent)', rep: 'liveLowerThird', path: ['right', 'visible'] },
		{ id: 'ticker', label: 'Ticker', group: 'En jeu (transparent)', rep: 'liveTicker', path: ['visible'] },
		{ id: 'replay-bug', label: 'Bug Replay', group: 'En jeu (transparent)', rep: 'liveReplayBug', path: ['visible'] },
		{ id: 'versus', label: 'Versus', group: 'Match', rep: 'matchGraphics', path: ['versus', 'visible'], fullscreen: true },
		{ id: 'veto', label: 'Veto des maps', group: 'Match', rep: 'matchGraphics', path: ['veto', 'visible'], fullscreen: true },
		{ id: 'veto-recap', label: 'Récap du veto', group: 'Match', rep: 'matchGraphics', path: ['vetoRecap', 'visible'], fullscreen: true },
		{ id: 'map-intro', label: 'Intro de map', group: 'Maps', rep: 'mapsGraphics', path: ['intro', 'visible'], fullscreen: true },
		{ id: 'map-series', label: 'Maps de la série', group: 'Maps', rep: 'mapsGraphics', path: ['series', 'visible'], fullscreen: true },
		{ id: 'map-result', label: 'Résultat de map', group: 'Maps', rep: 'mapsGraphics', path: ['result', 'visible'], fullscreen: true },
		{ id: 'player-stats', label: 'Stats joueur', group: 'Joueurs', rep: 'playerStatsGraphic', path: ['visible'], fullscreen: true, needs: (v) => !!v.playerId },
		{ id: 'player-duel', label: 'Duel', group: 'Joueurs', rep: 'playerDuel', path: ['visible'], fullscreen: true, needs: (v) => !!(v.left || v.right) },
		{ id: 'planning', label: 'Planning', group: 'Tournoi', rep: 'planningGraphic', path: ['visible'], fullscreen: true },
		{ id: 'groups', label: 'Groupes', group: 'Tournoi', rep: 'bracketGraphics', path: ['groups', 'visible'], fullscreen: true },
		{ id: 'bracket', label: 'Bracket', group: 'Tournoi', rep: 'bracketGraphics', path: ['bracket', 'visible'], fullscreen: true },
	];
	KBOList.item = (id) => KBOList.ITEMS.find((it) => it.id === id) || null;

	KBOList.SCENES = [
		['none', 'Jeu (aucune)'], ['starting', 'Bientôt'], ['brb', 'Pause'],
		['ending', 'Fin'], ['schedule', 'Planning'], ['dual-cam', '50/50 caméras'],
	];

	KBOList.STINGER_DEFAULT = { enabled: false };

	if (typeof module !== 'undefined' && module.exports) module.exports = KBOList;
	else root.KBOList = KBOList;
})(typeof window !== 'undefined' ? window : globalThis);
