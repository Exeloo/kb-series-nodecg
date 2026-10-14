// Logique serveur : live (lower thirds gauche / centre / droite + presets, ticker, écran 50/50, raccourcis de score de série)
// Replicants : liveLowerThird, liveLowerThirdPresets, liveTicker, liveDualCam (défauts : shared/live.js, LIVE.defaults)
// Masque seul un lower third après `duration` secondes. Message : 'live:series' { team, delta } → { A, B, currentMap }
const LIVE = require('../shared/live.js');

const clone = (o) => JSON.parse(JSON.stringify(o));
const WINS = { bo1: 1, bo3: 2, bo5: 3 };

module.exports = function (nodecg, listen) {
	const reps = {};
	for (const [name, def] of Object.entries(LIVE.defaults)) reps[name] = nodecg.Replicant(name, { defaultValue: clone(def) });
	const match = nodecg.Replicant('match');

	// Migrations : liveLowerThird { visible, title... } devient { left, center, right } ; { left, right } reçoit center
	const lt = reps.liveLowerThird;
	const v0 = lt.value;
	if (!LIVE.isCompleteLowerThird(v0)) lt.value = LIVE.normalizeLowerThird(v0);

	// ---------- Lower thirds : masquage automatique de chaque côté après `duration` secondes ----------
	// hideAt (heure du serveur, ms) : quand le masquage aura lieu, 0 = aucun. Lu par les panneaux (compte à rebours).
	const timers = {};
	const sig = (s) => s && JSON.stringify([s.title, s.subtitle, s.kicker, s.style, s.source, s.casterIndex, s.duration]);
	const setHideAt = (side, t) => { if (lt.value && lt.value[side] && (+lt.value[side].hideAt || 0) !== t) lt.value[side].hideAt = t; };
	lt.on('change', (v, old) => {
		if (!LIVE.isCompleteLowerThird(v)) { lt.value = LIVE.normalizeLowerThird(v); return; }
		for (const side of LIVE.SIDE_KEYS) {
			const s = v[side], o = old && old[side];
			if (!s || !s.visible) { clearTimeout(timers[side]); timers[side] = null; setHideAt(side, 0); continue; }
			const changed = !o || !o.visible || sig(o) !== sig(s);
			if (!changed) continue;
			clearTimeout(timers[side]); timers[side] = null;
			if (+s.duration > 0) {
				timers[side] = setTimeout(() => { if (lt.value && lt.value[side]) lt.value[side].visible = false; }, +s.duration * 1000);
				setHideAt(side, Date.now() + +s.duration * 1000);
			} else setHideAt(side, 0);
		}
	});
	// Au démarrage, aucun minuteur ne tourne encore : un hideAt resté d'avant le redémarrage est effacé
	for (const side of LIVE.SIDE_KEYS) if (lt.value && lt.value[side] && +lt.value[side].hideAt) lt.value[side].hideAt = 0;

	// ---------- Raccourcis score de série ----------
	// live:series { team: 'A'|'B', delta: 1|-1 } — met à jour match.maps[].winner / status / currentMap
	listen('live:series', (data) => {
		const team = data.team;
		const delta = +data.delta;
		if (!['A', 'B'].includes(team) || ![1, -1].includes(delta)) throw new Error('Paramètres invalides');
		const m = clone(match.value || {});
		m.maps = Array.isArray(m.maps) ? m.maps : [];
		const need = WINS[m.format] || 1;
		const score = () => m.maps.reduce((s, x) => { if (x.winner === 'A' || x.winner === 'B') s[x.winner]++; return s; }, { A: 0, B: 0 });
		let s = score();

		if (delta === 1) {
			if (s.A >= need || s.B >= need) throw new Error('Série déjà terminée');
			// Map gagnée = la map courante si elle n'a pas de vainqueur, sinon la première map sans vainqueur
			let idx = +m.currentMap || 0;
			if (!m.maps[idx] || m.maps[idx].winner) idx = m.maps.findIndex((x) => !x.winner);
			if (idx < 0) { m.maps.push({ map: null, pickedBy: null, scoreA: 0, scoreB: 0, winner: null, status: 'upcoming' }); idx = m.maps.length - 1; }
			Object.assign(m.maps[idx], { winner: team, status: 'done' });
			s = score();
			// Passe à la map suivante si la série continue
			const next = m.maps.findIndex((x, i) => i > idx && !x.winner);
			if (s.A < need && s.B < need && next >= 0) {
				m.currentMap = next;
				if (m.maps[next].status === 'upcoming' || !m.maps[next].status) m.maps[next].status = 'live';
			} else m.currentMap = idx;
		} else {
			// Annule la dernière map gagnée par cette équipe
			let idx = -1;
			m.maps.forEach((x, i) => { if (x.winner === team) idx = i; });
			if (idx < 0) throw new Error('Aucune map gagnée à retirer');
			Object.assign(m.maps[idx], { winner: null, status: 'live' });
			// Les maps suivantes non jouées repassent "à venir"
			m.maps.forEach((x, i) => { if (i > idx && !x.winner && x.status === 'live') x.status = 'upcoming'; });
			m.currentMap = idx;
		}
		match.value = m;
		const fin = score();
		return { A: fin.A, B: fin.B, currentMap: m.currentMap };
	});
};
