// Logique serveur : match (configuration du match, écran versus, veto, récap de veto)
// Replicants propres à cette partie (mêmes defaultValue côté client, voir shared/match.js) :
//   - matchGraphics : { versus: { visible }, veto: { visible }, vetoRecap: { visible } }
//                     visibilité des graphics versus.html / veto.html / veto-recap.html
//   - matchVeto     : { format: 'bo1'|'bo3'|'bo5', first: 'A'|'B', custom: bool, sequence: [{ action: 'ban'|'pick'|'decider', team: 'A'|'B'|null }] }
//                     déroulé prévu du veto (les étapes jouées sont dans le replicant coeur `veto`)
// Complète au démarrage une valeur matchGraphics persistée d'une version précédente (ex. sans vetoRecap).
// Format du match : match.format (panneau Match) et matchVeto.format (panneau Veto) restent identiques ; tant que
// l'ordre du veto n'a pas été modifié à la main (custom), il est recalculé quand le format, l'équipe qui commence
// ou le nombre de maps en rotation (veto.pool) change.
const { MATCH_DEFAULTS, FORMATS, buildSequence, sameSequence } = require('../shared/match.js');

const clone = (v) => JSON.parse(JSON.stringify(v));

module.exports = function (nodecg) {
	const gfx = nodecg.Replicant('matchGraphics', { defaultValue: clone(MATCH_DEFAULTS.matchGraphics) });
	// Rétro-compatibilité : complète une valeur persistée d'une version précédente (ex. sans vetoRecap)
	const v = gfx.value || {};
	const missing = Object.keys(MATCH_DEFAULTS.matchGraphics).filter((k) => !v[k] || typeof v[k].visible !== 'boolean');
	if (missing.length) {
		const next = { ...clone(MATCH_DEFAULTS.matchGraphics), ...v };
		for (const k of missing) next[k] = { visible: false };
		gfx.value = next;
	}
	const plan = nodecg.Replicant('matchVeto', { defaultValue: clone(MATCH_DEFAULTS.matchVeto) });
	const match = nodecg.Replicant('match');
	const veto = nodecg.Replicant('veto');
	const poolSize = () => ((veto.value && veto.value.pool) || []).length;

	// Ancienne valeur (sans first / custom) : « custom » seulement si la séquence ne correspond pas au calcul automatique
	const p0 = plan.value || {};
	if (typeof p0.custom !== 'boolean' || !['A', 'B'].includes(p0.first)) {
		const format = FORMATS.includes(p0.format) ? p0.format : 'bo3';
		const sequence = Array.isArray(p0.sequence) ? p0.sequence : buildSequence(format, poolSize());
		plan.value = { format, first: 'A', sequence, custom: !sameSequence(sequence, buildSequence(format, poolSize(), 'A')) };
	}

	function sync() {
		const p = plan.value, m = match.value;
		if (!p || !m) return;
		// Le format choisi d'un côté est recopié de l'autre (le dernier changé l'emporte : voir les écouteurs)
		if (!p.custom) {
			const seq = buildSequence(p.format, poolSize(), p.first);
			if (!sameSequence(seq, p.sequence)) p.sequence = seq;
		}
	}
	match.on('change', (m, old) => {
		if (!m || !plan.value || !FORMATS.includes(m.format)) return;
		if ((!old || old.format !== m.format) && plan.value.format !== m.format) plan.value.format = m.format;
	});
	plan.on('change', (p, old) => {
		if (!p) return;
		if (FORMATS.includes(p.format) && match.value && match.value.format !== p.format && (!old || old.format !== p.format)) match.value.format = p.format;
		sync();
	});
	veto.on('change', (v, old) => { if (!old || ((v && v.pool) || []).length !== ((old && old.pool) || []).length) sync(); });
};
