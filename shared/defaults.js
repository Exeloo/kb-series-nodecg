// Valeurs par défaut des replicants « coeur » (tournoi, match, veto, compte à rebours, scène…).
// SOURCE UNIQUE : le serveur (extension/) et les pages lisent ces mêmes valeurs, on ne les recopie nulle part.
// Navigateur : <script src="../shared/defaults.js"></script> → window.KBDefaults ; Node : require('../shared/defaults.js')
// Chaque entrée est une fonction qui renvoie un objet neuf (jamais d'objet partagé entre deux replicants).
// Les replicants propres à une partie ont leurs valeurs par défaut dans le fichier de la partie :
//   live.js (LIVE.defaults), match.js (MATCH_DEFAULTS), maps.js (KBM.DEFAULT, KBM.TRANSITION_DEFAULT),
//   player.js (KBP.STATS_DEFAULT, KBP.DUEL_DEFAULT), bracket.js (KBB.defaultBracket(), KBB.GRAPHICS_DEFAULT),
//   scenes.js (DEFAULT_TEXTS, DEFAULT_ROTATION).
(function (root) {
	// Pool de maps compétitif (modifiable depuis le panneau Veto)
	const DEFAULT_POOL = ['Abyss', 'Ascent', 'Bind', 'Corrode', 'Haven', 'Lotus', 'Sunset'];
	const COUNTDOWN_LABEL = 'Le stream commence dans';

	const D = {
		DEFAULT_POOL,
		COUNTDOWN_LABEL,

		// Infos générales du tournoi (reprises de l'affiche)
		tournament: () => ({
			name: 'KB SERIES',
			edition: 'Édition spéciale Epitech',
			presentedBy: 'CYCOM',
			subtitle: 'Tournoi Valorant 5v5',
			dates: '31/10 & 14/11',
			location: 'Campus KB · Le Kremlin-Bicêtre',
			hashtag: '#KBSERIES',
			socials: '',
		}),

		// Équipes : { [id]: { id, name, tag, logo, color, players: [{ riotId, role }] } }
		teams: () => ({}),

		// Match en cours. maps[] = { map, pickedBy: 'A'|'B'|'decider'|null, scoreA, scoreB, winner: null|'A'|'B',
		//   status: 'upcoming'|'live'|'done', picks?: { [riotId minuscules]: 'Agent' } }
		match: () => ({
			stage: 'Phase de groupes', // libellé libre : "Quart de finale", "Grande finale"…
			format: 'bo3',             // bo1 | bo3 | bo5
			teamA: null,               // id d'équipe (clé de `teams`)
			teamB: null,
			swap: false,               // inverse gauche/droite à l'écran
			currentMap: 0,             // index dans maps[]
			maps: [],
		}),

		// Veto : steps[] = { action: 'ban'|'pick'|'decider', team: 'A'|'B'|null, map, side: null|'attack'|'defense', sideTeam: null|'A'|'B' }
		veto: () => ({ pool: [...DEFAULT_POOL], steps: [] }),

		// Fiches joueurs saisies à la main (priment sur tracker.gg) et profils tracker.gg, clés = riotId en minuscules
		playerData: () => ({}),
		playerProfiles: () => ({}),

		casters: () => [{ name: 'Host', handle: '', role: 'host' }, { name: 'Caster 1', handle: '', role: 'caster' }, { name: 'Caster 2', handle: '', role: 'caster' }], // role : caster | host (LIVE.ROLES)

		// Planning à plat, CALCULÉ par extension/planning.js depuis le replicant `planning` (KBP.legacy, shared/planning.js) : ne pas l'écrire.
		// [{ id, time, end, label, phase, slot, format, teamA, teamB, status: 'upcoming'|'live'|'done', scoreA, scoreB, streamed, current }]
		schedule: () => [],

		// Compte à rebours partagé : endsAt = timestamp ms, ou null
		countdown: () => ({ endsAt: null, label: COUNTDOWN_LABEL }),

		// Scène de fond de graphics/stream.html : scene = 'none' (jeu) | 'starting' | 'brb' | 'ending' | 'schedule' | 'dual-cam' ; via = 'cut' | 'fade'
		streamScene: () => ({ scene: 'none', via: 'cut', at: 0 }),

		// Déclencheur du stinger : on écrit { at: Date.now(), map: 'Ascent'|null }
		transition: () => ({ at: 0, map: null, kind: 'logo' }), // kind : 'logo' | 'map' | 'replay' (KBM.trKind)

		// Données Valorant (maps, agents) mises en cache depuis valorant-api.com
		valorantData: () => ({ maps: {}, agents: {}, updatedAt: 0 }),
	};

	if (typeof module !== 'undefined' && module.exports) module.exports = D;
	else root.KBDefaults = D;
})(typeof window !== 'undefined' ? window : globalThis);
