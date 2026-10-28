// Données de TEST pour répéter avant le direct (bouton « Charger des données de test » du panneau Données) :
// match en cours, scores, veto, agents joués, planning de la phase finale (lié au bracket), bracket cohérent, compte à rebours.
// Ne crée AUCUN joueur : garde les vraies équipes et leurs joueurs, ajoute seulement des équipes adverses vides si besoin.
// Une sauvegarde complète est écrite avant. Message : 'data:testData' → { backup }
const D = require('../shared/defaults.js');
const KBB = require('../shared/bracket.js');
const KBPlan = require('../shared/planning.js');
const { clone } = require('./lib/backup');

// Équipes adverses (sans joueurs) ajoutées pour atteindre 8 équipes
const FILLER = [['Nova Rift', 'NVR', '#9b5cff'], ['Cycom Raiders', 'CYR', '#ff9a3c'], ['Bicêtre Blaze', 'BB', '#ff4655'],
	['Pasteur Phantoms', 'PPH', '#3ddc97'], ['Orbit Five', 'OR5', '#5ec4ff'], ['Starfall', 'SF', '#c9b274'],
	['Kremlin Kings', 'KK', '#f5c445'], ['Epitech Eclipse', 'EPX', '#3b8fe6']];

module.exports = function (nodecg, listen, backup) {
	const rep = (name) => nodecg.Replicant(name);

	listen('data:testData', () => {
		const file = backup.snapshot('avant-donnees-test');

		// Équipes : les 2 premières équipes existantes servent d'équipe A / B ; on complète avec des équipes vides
		const teams = clone(rep('teams').value) || {};
		for (const [name, tag, color] of FILLER) {
			if (Object.keys(teams).length >= 8) break;
			const id = tag.toLowerCase();
			if (!teams[id] && !Object.values(teams).some((t) => t && t.name === name)) teams[id] = { id, name, tag, color, logo: '', players: [] };
		}
		const ids = Object.keys(teams);
		const [A, B, t3, t4, t5, t6, t7, t8] = ids;
		rep('teams').value = teams;

		// Agents joués : agent favori tracker de chaque vrai joueur (sinon un agent par rôle)
		const profiles = rep('playerProfiles').value || {};
		const byRole = { duelist: 'Jett', initiator: 'Sova', controller: 'Omen', sentinel: 'Killjoy' };
		const pickFor = (p, shift) => {
			const prof = profiles[String(p.riotId).toLowerCase()];
			const ag = prof && Array.isArray(prof.agents) && prof.agents[shift % Math.max(1, prof.agents.length)];
			return (ag && ag.name) || byRole[String(p.role || '').toLowerCase()] || 'Sova';
		};
		const picks = (shift) => {
			const o = {};
			for (const id of [A, B]) for (const p of (teams[id] && teams[id].players) || []) if (p && p.riotId) o[String(p.riotId).toLowerCase()] = pickFor(p, shift);
			return o;
		};

		rep('match').value = {
			stage: 'Demi-finale', format: 'bo3', teamA: A || null, teamB: B || null, swap: false, currentMap: 1,
			maps: [
				{ map: 'Split', pickedBy: 'A', scoreA: 13, scoreB: 9, winner: 'A', status: 'done', picks: picks(0) },
				{ map: 'Ascent', pickedBy: 'B', scoreA: 7, scoreB: 5, winner: null, status: 'live', picks: picks(1) },
				{ map: 'Lotus', pickedBy: 'decider', scoreA: 0, scoreB: 0, winner: null, status: 'upcoming', picks: {} },
			],
		};
		rep('veto').value = {
			pool: ['Abyss', 'Ascent', 'Bind', 'Corrode', 'Lotus', 'Split', 'Sunset'],
			steps: [
				{ action: 'ban', team: 'A', map: 'Bind', side: null, sideTeam: null },
				{ action: 'ban', team: 'B', map: 'Abyss', side: null, sideTeam: null },
				{ action: 'pick', team: 'A', map: 'Split', sideTeam: 'B', side: 'defense' },
				{ action: 'pick', team: 'B', map: 'Ascent', sideTeam: 'A', side: 'attack' },
				{ action: 'ban', team: 'A', map: 'Sunset', side: null, sideTeam: null },
				{ action: 'ban', team: 'B', map: 'Corrode', side: null, sideTeam: null },
				{ action: 'decider', team: null, map: 'Lotus', sideTeam: 'A', side: 'defense' },
			],
		};

		const label = (rep('countdown').value || {}).label || D.COUNTDOWN_LABEL;
		rep('countdown').value = { endsAt: Date.now() + 10 * 60 * 1000, label };

		// Bracket cohérent avec le planning
		const standing = (id, w, l, rw, rl) => ({ id, w, l, rw, rl });
		const m = KBB.emptyMatch;
		const bk = KBB.defaultBracket();
		bk.qualify = 4;
		bk.groups = [
			{ name: 'Groupe A', teams: [standing(A, 3, 0, 39, 21), standing(t4, 2, 1, 34, 30), standing(t7, 1, 2, 29, 35), standing(t8, 0, 3, 22, 38)].filter((t) => t.id) },
			{ name: 'Groupe B', teams: [standing(t3, 3, 0, 39, 25), standing(B, 2, 1, 36, 28), standing(t5, 1, 2, 30, 33), standing(t6, 0, 3, 20, 39)].filter((t) => t.id) },
		];
		bk.playoffs = {
			quarters: [
				m({ a: A, b: t6, scoreA: 2, scoreB: 0, winner: 'a', status: 'done', time: '10:00' }),
				m({ a: B, b: t7, scoreA: 2, scoreB: 1, winner: 'a', status: 'done', time: '11:30' }),
				m({ a: t3, b: t8, scoreA: 2, scoreB: 1, winner: 'a', status: 'done', time: '10:00' }),
				m({ a: t4, b: t5, scoreA: 1, scoreB: 2, winner: 'b', status: 'done', time: '11:30' }),
			],
			semis: [m({ scoreA: 1, scoreB: 0, status: 'live', time: '14:00' }), m({ time: '15:30' })],
			third: m({ time: '17:00' }),
			final: m({ time: '18:30' }),
		};
		KBB.propagate(bk);
		rep('bracket').value = bk;

		// Planning de la phase finale, lié au bracket (créneaux d'une heure, deux quarts en parallèle dont un seul diffusé) ;
		// la demi-finale 1 est le match en cours. Heures et liste `schedule` calculées par extension/planning.js
		const plan = (slot, phase, ref, streamed) => KBPlan.newRow(phase, { slot, ref, streamed });
		const rows = [plan(0, 'quarter', 0, true), plan(0, 'quarter', 2, false), plan(1, 'quarter', 1, true), plan(1, 'quarter', 3, false),
			plan(2, 'semi', 0, true), plan(3, 'semi', 1, true), plan(4, 'third', 0, true), plan(5, 'final', 0, true)];
		rep('planning').value = { ...KBPlan.DEFAULT, start: '10:00', duration: 60, current: rows[4].id, matches: rows };

		nodecg.log.info(`Données de test chargées — sauvegarde : ${file}`);
		return { backup: backup.relative(file) };
	});
};
