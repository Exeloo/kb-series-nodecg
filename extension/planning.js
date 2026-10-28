// Logique serveur : planning de la journée (modèle et champs : shared/planning.js)
//   planning         : { start, duration, current, matches: [row] } — source unique, écrit par le panneau Planning
//   planningGraphic  : { visible } — overlay plein écran graphics/planning.html (piloté par KBO : Régie, panneau, Companion)
// Liens tenus à jour ici, quel que soit l'écrivain (panneau, autre extension, import) :
//   - bracket  : heure (et libellé libre) des matchs de phase finale liés ; classement des groupes calculé depuis les matchs de poules
//                (seulement les groupes qui ont des matchs au planning) ;
//   - schedule : liste à plat (KBPlan.legacy) pour les écrans Pause, Fin, Bientôt et le lower third « Prochain match » ;
//   - match    : le match en cours (planning.current) renvoie son score de série, ses rounds et son statut au planning
//                (phase de poules) ou au bracket (phase finale) ; des équipes qui ne correspondent plus coupent le lien.
// Messages : 'planning:start' { id } → { title, reset } (charge le match dans `match`, remet maps et veto à zéro si les équipes changent,
//            sauvegarde avant) ; 'planning:stop' → { stopped } (plus de match suivi).
const KBPlan = require('../shared/planning.js');
const KBB = require('../shared/bracket.js');

const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const WINS = { bo1: 1, bo3: 2, bo5: 3 };
const validBracket = (bk) => !!bk && typeof bk === 'object' && Array.isArray(bk.groups) && !!bk.playoffs && typeof bk.playoffs === 'object';
const sameTeams = (x, y) => (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0]);

module.exports = function (nodecg, listen, backup) {
	const planning = nodecg.Replicant('planning', { defaultValue: clone(KBPlan.DEFAULT) });
	nodecg.Replicant('planningGraphic', { defaultValue: clone(KBPlan.GRAPHIC_DEFAULT) });
	const schedule = nodecg.Replicant('schedule');
	const bracket = nodecg.Replicant('bracket', { defaultValue: KBB.defaultBracket() });
	const match = nodecg.Replicant('match');
	const veto = nodecg.Replicant('veto');

	// Reprise d'un ancien planning (liste `schedule` saisie à la main dans le panneau Écrans) : au démarrage, et quand une sauvegarde
	// ou un export d'une version précédente le réécrit, tant que le planning est vide
	const isLegacy = (rows) => Array.isArray(rows) && rows.length > 0 && !rows.some((r) => r && r.slot !== undefined);
	function migrate() {
		const legacyRows = schedule.value;
		if ((planning.value && (planning.value.matches || []).length) || !isLegacy(legacyRows)) return false;
		const p = KBPlan.fromLegacy(legacyRows);
		if (validBracket(bracket.value)) {
			// Équipes et scores des anciennes lignes de phase finale → matchs du bracket encore vides
			const bk = clone(bracket.value);
			p.matches.forEach((r, i) => {
				const m = KBPlan.bracketMatch(bk, r), old = legacyRows[i];
				if (!m || m.a || m.b || !(old.teamA || old.teamB)) return;
				Object.assign(m, { a: old.teamA || null, b: old.teamB || null, scoreA: +old.scoreA || 0, scoreB: +old.scoreB || 0, status: r.status });
			});
			KBB.propagate(bk);
			if (!same(bk, bracket.value)) bracket.value = bk;
		}
		planning.value = p;
		nodecg.log.info(`Planning : ${p.matches.length} match(s) repris de l'ancien planning`);
		return true;
	}
	migrate();

	// ---------- planning → bracket, schedule ----------
	let busy = false;
	function sync() {
		if (busy) return;
		busy = true;
		try {
			const p = KBPlan.normalize(planning.value);
			if (validBracket(bracket.value)) {
				const bk = clone(bracket.value);
				for (const r of p.matches) {
					const m = KBPlan.bracketMatch(bk, r);
					if (!m) continue;
					const t = KBPlan.slotTime(p, r.slot);
					if (m.time !== t) m.time = t;
					if (r.label && m.label !== r.label) m.label = r.label;
				}
				bk.groups = KBPlan.groupStandings(bk, p);
				if (!same(bk, bracket.value)) bracket.value = bk;
			}
			const flat = KBPlan.legacy(p, bracket.value);
			if (!same(flat, schedule.value)) schedule.value = flat;
		} catch (e) {
			// Appelé lors d'une écriture venant d'un panneau : une exception ici arrêterait le serveur
			nodecg.log.warn('Planning : synchronisation impossible :', e.message);
		} finally {
			busy = false;
		}
	}
	planning.on('change', sync);
	bracket.on('change', sync);
	// `schedule` est calculé : une autre valeur (restauration, import, ancien panneau) est reprise ou recalculée
	schedule.on('change', () => { if (!busy && !migrate()) sync(); });

	// ---------- match en cours → planning / bracket ----------
	function fromMatch(m) {
		const p = KBPlan.normalize(planning.value);
		const row = p.matches.find((r) => r.id === p.current);
		if (!row || !m) return;
		const bk = validBracket(bracket.value) ? clone(bracket.value) : null;
		const bm = bk && KBPlan.bracketMatch(bk, row);
		if (KBPlan.isLinked(row) && !bm) return;
		const rowTeams = bm ? [bm.a || null, bm.b || null] : [row.teamA, row.teamB];
		const mTeams = [m.teamA || null, m.teamB || null];
		// Le match en cours a changé d'affiche (nouveau match saisi à la main) : il ne correspond plus à cette ligne
		if (rowTeams[0] && rowTeams[1] && mTeams[0] && mTeams[1] && !sameTeams(rowTeams, mTeams)) {
			planning.value = { ...p, current: null };
			nodecg.log.info(`Planning : le match en cours ne correspond plus à « ${KBPlan.label(row, bk)} », suivi arrêté`);
			return;
		}
		const s = { A: 0, B: 0 }, rounds = [0, 0];
		for (const x of m.maps || []) {
			if (x && (x.winner === 'A' || x.winner === 'B')) s[x.winner]++;
			rounds[0] += +(x && x.scoreA) || 0; rounds[1] += +(x && x.scoreB) || 0;
		}
		const decided = Math.max(s.A, s.B) >= (WINS[m.format] || WINS[row.format] || 1);
		const status = decided ? 'done' : 'live';
		// Côtés : l'équipe A du match peut être l'équipe B de la ligne
		const swap = rowTeams[0] && rowTeams[0] === mTeams[1] && rowTeams[1] !== mTeams[1];
		const [a, b] = swap ? [s.B, s.A] : [s.A, s.B];
		const [ra, rb] = swap ? [rounds[1], rounds[0]] : rounds;
		const prevDone = (bm ? bm.status : row.status) === 'done';
		// Match remis à zéro alors que la ligne était terminée : on garde le résultat
		if (prevDone && !a && !b && !(m.maps || []).length) return;
		if (bm) {
			const next = { ...bm, scoreA: a, scoreB: b, status, winner: decided ? (a > b ? 'a' : 'b') : null };
			if (!bm.a && mTeams[0]) next.a = swap ? mTeams[1] : mTeams[0];
			if (!bm.b && mTeams[1]) next.b = swap ? mTeams[0] : mTeams[1];
			if (!same(next, bm)) { Object.assign(bm, next); KBB.propagate(bk); bracket.value = bk; }
		} else {
			// BO1 de poules : le score affiché est celui des rounds (13-7), comme quand il est saisi à la main
			const bo1 = (m.format || row.format) === 'bo1';
			const next = { ...row, scoreA: bo1 ? ra : a, scoreB: bo1 ? rb : b, status, rounds: [ra, rb], teamA: row.teamA || mTeams[0], teamB: row.teamB || mTeams[1] };
			if (!same(next, row)) planning.value = { ...p, matches: p.matches.map((r) => (r.id === row.id ? next : r)) };
		}
	}
	match.on('change', (m) => { try { fromMatch(m); } catch (e) { nodecg.log.warn('Planning : score du match en cours non repris :', e.message); } });

	// ---------- Messages ----------
	listen('planning:start', ({ id } = {}) => {
		const p = KBPlan.normalize(planning.value);
		const row = p.matches.find((r) => r.id === id);
		if (!row) throw new Error('Match introuvable dans le planning');
		if (KBPlan.isBreak(row)) throw new Error('Une pause ne se lance pas sur le stream');
		const v = KBPlan.resolve(p, row, bracket.value);
		const m = clone(match.value || {});
		const keep = !!(m.teamA || m.teamB) && sameTeams([m.teamA || null, m.teamB || null], [v.teamA, v.teamB]);
		if (!keep) {
			backup.snapshot('avant-lancer-match');
			m.maps = []; m.currentMap = 0; m.swap = false;
			m.teamA = v.teamA; m.teamB = v.teamB;
			if (veto.value) veto.value = { ...clone(veto.value), steps: [] };
		}
		m.stage = v.title;
		m.format = row.format;
		// Lancé sur le stream : en cours et diffusé
		const rows = p.matches.map((r) => (r.id === id ? { ...r, streamed: true, status: KBPlan.isLinked(r) || r.status === 'done' ? r.status : 'live' } : r));
		planning.value = { ...p, current: id, matches: rows };
		if (KBPlan.isLinked(row) && validBracket(bracket.value)) {
			const bk = clone(bracket.value);
			const bm = KBPlan.bracketMatch(bk, row);
			if (bm && bm.status === 'upcoming') { bm.status = 'live'; bracket.value = bk; }
		}
		match.value = m;
		nodecg.log.info(`Planning : « ${v.title} » lancé sur le stream${keep ? '' : ' (maps et veto remis à zéro)'}`);
		return { title: v.title, reset: !keep };
	});
	listen('planning:stop', () => {
		const p = KBPlan.normalize(planning.value);
		if (!p.current) return { stopped: false };
		planning.value = { ...p, current: null };
		return { stopped: true };
	});

	sync();
};
