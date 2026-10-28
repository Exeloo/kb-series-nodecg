// Partie "planning" : modèle du planning de la journée, partagé serveur + navigateur.
// Navigateur : <script src="../shared/planning.js"></script> (après bracket.js) → window.KBPlan ; Node : require('../shared/planning.js')
//
// Replicant `planning` (source unique, écrit par le panneau Planning et par extension/planning.js) :
//   { start: 'HH:MM', duration: minutes (60), current: id | null, matches: [row] }
//   row = { id, slot, phase, ref, group, teamA, teamB, scoreA, scoreB, status, streamed, format, label, rounds, minutes }
//     slot     créneau à partir de 0, dans l'ordre de la journée ; plusieurs matchs par créneau = joués en même temps.
//              Un créneau dure son match (ou sa pause) le plus long : heure = start + durée des créneaux d'avant
//     phase    'pool' | 'quarter' | 'semi' | 'third' | 'final' (KBPlan.PHASES), ou 'break' : pause (label = nom, minutes = durée)
//     minutes  durée du match (null = `duration` de la journée) ; un créneau dure son match (ou sa pause) le plus long
//     ref      phase finale : quel match du bracket (quart 0-3, demi 0-1 ; 0 pour les finales)
//     group    phase de poules : index du groupe dans bracket.groups (ou null)
//     teamA/B, scoreA/B, status ('upcoming' | 'live' | 'done'), rounds ([a, b] rounds cumulés, repris du match en cours)
//              ne servent qu'à la phase de poules : en phase finale, équipes, scores et statut sont ceux du bracket (KBPlan.resolve)
//     streamed diffusé sur le stream ; format 'bo1' | 'bo3' | 'bo5' ; label libellé libre (sinon KBPlan.label)
//   current = match en cours sur le stream : chargé dans le replicant `match` (panneau Planning, « Lancer »), son score revient ici.
// Replicant `schedule` : liste à plat calculée par le serveur (KBPlan.legacy) pour les écrans qui la lisaient déjà (Pause, Fin, Bientôt,
// lower third « Prochain match »). Ne pas l'écrire ailleurs.
(function (root) {
	const P = {};

	P.PHASES = { pool: 'Phase de poules', quarter: 'Quart de finale', semi: 'Demi-finale', third: 'Petite finale', final: 'Grande finale' };
	P.PHASE_SHORT = { pool: 'Poules', quarter: 'Quarts', semi: 'Demies', third: 'Petite finale', final: 'Grande finale' };
	P.PHASE_ORDER = ['pool', 'quarter', 'semi', 'third', 'final'];
	/** Phases liées au bracket : nombre de matchs et chemin dans bracket.playoffs */
	P.BRACKET = { quarter: { n: 4, key: 'quarters' }, semi: { n: 2, key: 'semis' }, third: { n: 1, key: 'third' }, final: { n: 1, key: 'final' } };
	P.FORMAT_DEFAULT = { pool: 'bo1', quarter: 'bo3', semi: 'bo3', third: 'bo3', final: 'bo5' };
	P.STATUSES = ['upcoming', 'live', 'done'];
	P.BREAK_DEFAULT = { label: 'Pause', minutes: 30 };
	P.isBreak = (row) => !!row && row.phase === 'break';
	P.DEFAULT = { start: '10:00', duration: 60, current: null, matches: [] };
	P.GRAPHIC_DEFAULT = { visible: false };

	const num = (x) => (Number.isFinite(+x) ? +x : 0);
	const scoreOrNull = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(+x) ? null : Math.max(0, Math.floor(+x)));
	const isTime = (s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
	P.newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

	/** Planning nettoyé (valeurs bornées, champs manquants complétés) ; ne modifie pas l'entrée */
	P.normalize = (v) => {
		v = v && typeof v === 'object' ? v : {};
		const matches = (Array.isArray(v.matches) ? v.matches : []).filter((r) => r && typeof r === 'object').map(P.normalizeRow);
		const ids = new Set(matches.map((r) => r.id));
		return {
			start: isTime(v.start) ? v.start.padStart(5, '0') : P.DEFAULT.start,
			duration: Math.min(480, Math.max(10, Math.round(num(v.duration) || P.DEFAULT.duration))),
			current: ids.has(v.current) ? v.current : null,
			matches,
		};
	};
	P.normalizeRow = (r) => {
		if (r.phase === 'break') {
			// Pause : seulement un nom, une durée et un créneau
			return {
				id: String(r.id || P.newId()), slot: Math.max(0, Math.floor(num(r.slot))), phase: 'break', ref: 0, group: null,
				teamA: null, teamB: null, scoreA: null, scoreB: null, status: 'upcoming', streamed: false, format: '', rounds: null,
				label: String(r.label ?? P.BREAK_DEFAULT.label).slice(0, 60),
				minutes: Math.min(480, Math.max(5, Math.round(num(r.minutes) || P.BREAK_DEFAULT.minutes))),
			};
		}
		const phase = P.PHASES[r.phase] ? r.phase : 'pool';
		const b = P.BRACKET[phase];
		return {
			id: String(r.id || P.newId()),
			slot: Math.max(0, Math.floor(num(r.slot))),
			phase,
			ref: b ? Math.min(b.n - 1, Math.max(0, Math.floor(num(r.ref)))) : 0,
			group: phase === 'pool' && r.group !== null && r.group !== undefined && r.group !== '' && Number.isFinite(+r.group) ? Math.max(0, Math.floor(+r.group)) : null,
			teamA: r.teamA || null,
			teamB: r.teamB || null,
			scoreA: scoreOrNull(r.scoreA),
			scoreB: scoreOrNull(r.scoreB),
			status: P.STATUSES.includes(r.status) ? r.status : 'upcoming',
			streamed: r.streamed !== false,
			format: ['bo1', 'bo3', 'bo5'].includes(r.format) ? r.format : P.FORMAT_DEFAULT[phase],
			label: String(r.label || '').slice(0, 60),
			rounds: Array.isArray(r.rounds) && r.rounds.length === 2 ? [num(r.rounds[0]), num(r.rounds[1])] : null,
			minutes: r.minutes === null || r.minutes === undefined || r.minutes === '' || !(+r.minutes > 0) ? null : Math.min(480, Math.max(10, Math.round(+r.minutes))),
		};
	};
	P.newRow = (phase = 'pool', extra = {}) => P.normalizeRow({ id: P.newId(), phase, ...extra });

	// ---------- Heures ----------
	const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
	const fmt = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
	/** Durée d'un match ou d'une pause (min) : la sienne, sinon la durée par défaut de la journée (ou d'une pause) */
	P.rowLength = (p, r) => (P.isBreak(r) ? r.minutes || P.BREAK_DEFAULT.minutes : r.minutes || p.duration);
	/** Durée d'un créneau (min) : celle de son match (ou de sa pause) le plus long ; un créneau vide compte pour un match */
	P.slotLength = (p, slot) => {
		const rows = (p.matches || []).filter((r) => r.slot === slot);
		return rows.length ? Math.max(...rows.map((r) => P.rowLength(p, r))) : p.duration;
	};
	/** Début d'un créneau en minutes depuis minuit (les créneaux vides comptent pour un match) */
	const slotStart = (p, slot) => { let t = toMin(p.start); for (let s = 0; s < slot; s++) t += P.slotLength(p, s); return t; };
	P.slotTime = (p, slot) => fmt(slotStart(p, slot));
	P.slotEnd = (p, slot) => fmt(slotStart(p, slot) + P.slotLength(p, slot));

	// ---------- Lien avec le bracket ----------
	P.isLinked = (row) => !!P.BRACKET[row.phase];
	/** Chemin du match lié dans le replicant bracket ('playoffs.quarters.0', 'playoffs.final'…) ou null */
	P.bracketPath = (row) => {
		const b = P.BRACKET[row.phase];
		if (!b) return null;
		return b.n > 1 ? `playoffs.${b.key}.${row.ref}` : `playoffs.${b.key}`;
	};
	P.bracketMatch = (bk, row) => {
		const b = P.BRACKET[row.phase];
		const po = bk && bk.playoffs;
		if (!b || !po) return null;
		const m = b.n > 1 ? (po[b.key] || [])[row.ref] : po[b.key];
		return m && typeof m === 'object' ? m : null;
	};
	const groupName = (bk, gi) => {
		const g = gi === null || gi === undefined ? null : ((bk && bk.groups) || [])[gi];
		return g ? g.name || 'G ' + String.fromCharCode(65 + gi) : '';
	};
	/** Libellé affiché : libre, sinon « Quart de finale 2 », « Phase de poules · Groupe A »… */
	P.label = (row, bk) => {
		if (row.label) return row.label;
		if (P.isBreak(row)) return P.BREAK_DEFAULT.label;
		const base = P.PHASES[row.phase];
		if (row.phase === 'quarter' || row.phase === 'semi') return `${base} ${row.ref + 1}`;
		if (row.phase === 'pool') { const g = groupName(bk, row.group); return g ? `${base} · ${g}` : base; }
		return base;
	};

	/**
	 * Match tel qu'il faut l'afficher : équipes, scores, statut et vainqueur ('A' | 'B' | null) lus dans le bracket pour la phase finale,
	 * dans la ligne pour la phase de poules ; heure du créneau, libellé, match en cours (current).
	 */
	P.resolve = (p, row, bk) => {
		if (P.isBreak(row)) {
			return { ...row, winner: null, time: P.slotTime(p, row.slot), end: P.slotEnd(p, row.slot), title: row.label || P.BREAK_DEFAULT.label, groupName: '', current: false };
		}
		const m = P.isLinked(row) ? P.bracketMatch(bk, row) : null;
		const base = m
			? { teamA: m.a || null, teamB: m.b || null, scoreA: scoreOrNull(m.scoreA), scoreB: scoreOrNull(m.scoreB), status: P.STATUSES.includes(m.status) ? m.status : 'upcoming',
				winner: m.winner === 'a' ? 'A' : m.winner === 'b' ? 'B' : null }
			: { teamA: row.teamA, teamB: row.teamB, scoreA: row.scoreA, scoreB: row.scoreB, status: row.status, winner: null };
		if (!m && base.status === 'done' && num(base.scoreA) !== num(base.scoreB)) base.winner = num(base.scoreA) > num(base.scoreB) ? 'A' : 'B';
		// Un score sans match commencé n'a pas de sens à l'écran
		if (base.status === 'upcoming' && !num(base.scoreA) && !num(base.scoreB)) { base.scoreA = null; base.scoreB = null; }
		return {
			...row, ...base,
			time: P.slotTime(p, row.slot), end: P.slotEnd(p, row.slot),
			title: P.label(row, bk), short: P.shortLabel(row, bk), groupName: row.phase === 'pool' ? groupName(bk, row.group) : '',
			current: p.current === row.id,
		};
	};

	/** Libellé court pour une carte étroite : « Poules · Groupe A », « QF1 », « DF2 », « Petite finale »… */
	P.shortLabel = (row, bk) => {
		if (row.label) return row.label;
		if (row.phase === 'quarter') return `QF${row.ref + 1}`;
		if (row.phase === 'semi') return `DF${row.ref + 1}`;
		if (row.phase === 'pool') { const g = groupName(bk, row.group); return g ? `Poules · ${g}` : 'Poules'; }
		return P.label(row, bk);
	};

	/** Texte à la place d'une équipe pas encore connue : « Vainqueur QF1 », « Perdant DF2 »… */
	P.placeholder = (row, side) => {
		const i = side === 'B' ? 1 : 0;
		if (row.phase === 'semi') return `Vainqueur QF${row.ref * 2 + i + 1}`;
		if (row.phase === 'final') return `Vainqueur DF${i + 1}`;
		if (row.phase === 'third') return `Perdant DF${i + 1}`;
		return 'À déterminer';
	};

	/** Tous les matchs résolus, triés par créneau (puis ordre de saisie) */
	P.view = (planning, bk) => {
		const p = P.normalize(planning);
		return p.matches.map((r, i) => ({ r, i })).sort((x, y) => x.r.slot - y.r.slot || x.i - y.i).map(({ r }) => P.resolve(p, r, bk));
	};
	/** Créneaux : [{ slot, time, end, matches: [vue] }] */
	P.slots = (planning, bk) => {
		const p = P.normalize(planning);
		const out = [];
		for (const v of P.view(p, bk)) {
			let s = out[out.length - 1];
			if (!s || s.slot !== v.slot) out.push((s = { slot: v.slot, time: v.time, end: v.end, matches: [] }));
			s.matches.push(v);
		}
		return out;
	};

	/** Liste à plat pour le replicant `schedule` (écrans Pause, Fin, Bientôt, lower third « Prochain match ») */
	P.legacy = (planning, bk) => P.view(planning, bk).filter((v) => !P.isBreak(v)).map((v) => ({
		id: v.id, time: v.time, end: v.end, label: v.title, phase: v.phase, slot: v.slot, format: v.format,
		teamA: v.teamA, teamB: v.teamB, status: v.status, scoreA: v.scoreA, scoreB: v.scoreB, streamed: v.streamed, current: v.current,
	}));

	/**
	 * Classement des groupes calculé depuis les matchs de poules du planning (V / D, rounds) : seulement pour les groupes qui ont au moins
	 * un match de poules au planning (les autres restent saisis à la main). Les équipes des matchs absentes du groupe y sont ajoutées.
	 * Rounds : cumul des rounds des maps quand le match est passé par le match en cours (row.rounds), sinon le score saisi.
	 * Renvoie un nouveau tableau de groupes (l'entrée n'est pas modifiée).
	 */
	P.groupStandings = (bk, planning) => {
		const p = P.normalize(planning);
		const groups = ((bk && bk.groups) || []).map((g) => ({ ...g, teams: ((g && g.teams) || []).map((t) => ({ ...t })) }));
		groups.forEach((g, gi) => {
			const rows = p.matches.filter((r) => r.phase === 'pool' && r.group === gi);
			if (!rows.length) return;
			const byId = new Map();
			const teams = [];
			const add = (id) => {
				if (!id || byId.has(id)) return;
				const t = { id, w: 0, l: 0, rw: 0, rl: 0 };
				byId.set(id, t);
				teams.push(t);
			};
			g.teams.filter((t) => t && t.id).forEach((t) => add(t.id));
			for (const r of rows) { add(r.teamA); add(r.teamB); }
			for (const r of rows) {
				if (r.status !== 'done' || !r.teamA || !r.teamB || r.teamA === r.teamB) continue;
				const a = num(r.scoreA), b = num(r.scoreB);
				const [ra, rb] = r.rounds || [a, b];
				const A = byId.get(r.teamA), B = byId.get(r.teamB);
				A.rw += ra; A.rl += rb; B.rw += rb; B.rl += ra;
				if (a > b) { A.w++; B.l++; } else if (b > a) { B.w++; A.l++; }
			}
			g.teams = teams;
		});
		return groups;
	};
	/** Index des groupes dont le classement est calculé depuis le planning */
	P.computedGroups = (planning) => new Set(P.normalize(planning).matches.filter((r) => r.phase === 'pool' && r.group !== null).map((r) => r.group));
	/** Chemins des matchs du bracket liés au planning ('playoffs.quarters.0'…) → id de la ligne */
	P.linkedPaths = (planning) => new Map(P.normalize(planning).matches.filter(P.isLinked).map((r) => [P.bracketPath(r), r.id]));

	/** Reprend un ancien planning (liste `schedule`) : créneau d'après l'heure, phase d'après le libellé */
	P.fromLegacy = (rows) => {
		rows = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object');
		const times = rows.map((r) => r.time).filter(isTime).map(toMin);
		const start = times.length ? Math.min(...times) : toMin(P.DEFAULT.start);
		const count = { quarter: 0, semi: 0 };
		const matches = rows.map((r, i) => {
			const l = String(r.label || '').toLowerCase();
			const phase = /quart/.test(l) ? 'quarter' : /demi/.test(l) ? 'semi' : /petite/.test(l) ? 'third' : /final/.test(l) ? 'final' : 'pool';
			const n = /(\d+)/.exec(l);
			const ref = P.BRACKET[phase] && P.BRACKET[phase].n > 1 ? (n ? +n[1] - 1 : count[phase]++) : 0;
			const slot = isTime(r.time) ? Math.max(0, Math.round((toMin(r.time) - start) / P.DEFAULT.duration)) : i;
			return P.normalizeRow({ ...r, id: P.newId() + i, phase, ref, slot, label: phase === 'pool' ? r.label : '' });
		});
		return { ...P.DEFAULT, start: fmt(start), matches };
	};

	if (typeof module !== 'undefined' && module.exports) module.exports = P;
	else root.KBPlan = P;
})(typeof window !== 'undefined' ? window : globalThis);
