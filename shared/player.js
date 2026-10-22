// Helpers partie "player" (graphics + dashboard). Requiert shared/kb.js (KB.player, KB.teamOf, KB.roleLabel…).
// Navigateur : window.KBP ; Node : require('../shared/player.js') (valeurs par défaut des replicants)
(function (root) {
	const P = {};
	// Valeurs par défaut des replicants playerStatsGraphic et playerDuel
	// view : vue de la fiche Stats joueur (P.VIEWS) ; absent = 'overview' (valeurs enregistrées avant son ajout)
	P.STATS_DEFAULT = { playerId: null, visible: false, agentId: null, view: 'overview' };
	P.VIEWS = { overview: 'Stats générales', roles: 'Performances par rôle' };
	P.view = (g) => (g && P.VIEWS[g.view] ? g.view : 'overview');

	// Rôles d'agent Valorant, dans l'ordre d'affichage d'un rôle jamais joué (clés de KB.ROLES)
	P.ROLE_KEYS = ['duelist', 'initiator', 'controller', 'sentinel'];
	/**
	 * Lignes du tableau « par rôle » d'un joueur (KB.player(...).roles) : les 4 rôles, toujours.
	 * Rôles joués du plus joué au moins joué (temps de jeu), puis ceux jamais joués ({ key, played: false }).
	 * main = rôle le plus joué ; share = part du temps de jeu (0-100).
	 */
	P.roleRows = (roles) => {
		const played = (roles || []).filter((r) => r && r.key && (r.matchesValue || r.timeValue));
		const total = played.reduce((t, r) => t + (r.timeValue || 0), 0);
		const rows = played.map((r, i) => ({ ...r, played: true, main: i === 0, share: total ? Math.round((r.timeValue || 0) / total * 100) : 0 }));
		for (const key of P.ROLE_KEYS) if (!rows.some((r) => r.key === key)) rows.push({ key, played: false, main: false, share: 0 });
		return rows;
	};
	P.DUEL_DEFAULT = { left: null, right: null, visible: false };

	/** Stats comparées dans le duel */
	P.DUEL_STATS = [
		{ key: 'kd', label: 'K/D' },
		{ key: 'acs', label: 'ACS' },
		{ key: 'adr', label: 'ADR' },
		{ key: 'hs', label: 'HS%' },
		{ key: 'kast', label: 'KAST' },
		{ key: 'firstBloods', label: 'First Bloods' },
		{ key: 'winPct', label: 'Win%' },
	];

	/**
	 * Remplit un conteneur de n particules lumineuses qui montent lentement (style `#motes i` dans la page).
	 * Positions et délais calculés, sans hasard : le rendu est le même à chaque chargement.
	 *  spread : écart horizontal entre deux particules (px, modulo 1900) · lag : décalage de phase entre deux particules (s, modulo 12)
	 */
	P.motes = (el, n, { spread = 137, lag = 1.7 } = {}) => {
		el.innerHTML = Array.from({ length: n }, (_, i) => {
			const x = (i * spread) % 1900, d = (i * lag) % 12, t = 12 + (i % 5) * 3, s = 2 + (i % 3);
			return `<i style="left:${x}px;width:${s}px;height:${s}px;animation-duration:${t}s;animation-delay:-${d}s"></i>`;
		}).join('');
	};

	if (typeof module !== 'undefined' && module.exports) module.exports = P;
	else root.KBP = P;
})(typeof window !== 'undefined' ? window : globalThis);
