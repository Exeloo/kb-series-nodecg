// Partie "live" : valeurs par défaut des replicants live* + géométrie de l'écran 50/50.
// Partagé entre extension/live.js (require) et les pages (window.LIVE).
(function (root) {
	const LIVE = {};

	// Un lower third (un "slot" gauche, centre ou droite)
	// style : standard | gold | alert ; source : custom | caster (caster = suit en direct l'intervenant casters[casterIndex])
	LIVE.slotDefault = () => ({ visible: false, style: 'standard', kicker: '', title: '', subtitle: '', source: 'custom', casterIndex: 0, duration: 0 });
	// Emplacements des lower thirds, dans l'ordre d'affichage à l'écran
	LIVE.SIDES = { left: 'Gauche', center: 'Centre', right: 'Droite' };
	LIVE.SIDE_KEYS = Object.keys(LIVE.SIDES);

	// Intervenants (replicant casters = [{ name, handle, role }]) ; role absent = caster (anciennes données)
	LIVE.ROLES = { caster: 'Caster', host: 'Host' };
	LIVE.roleOf = (c) => (c && LIVE.ROLES[c.role] ? c.role : 'caster');
	LIVE.roleLabel = (c) => LIVE.ROLES[LIVE.roleOf(c)];

	// Label d'une moitié de l'écran 50/50
	// mode : none | text | team | player ; team : 'A' | 'B' (équipes du match) ou id d'équipe ; riotId : joueur (KB.player)
	LIVE.camLabelDefault = (team) => ({ mode: 'team', text: '', sub: '', team, riotId: '' });

	LIVE.defaults = {
		liveLowerThird: { left: LIVE.slotDefault(), center: LIVE.slotDefault(), right: LIVE.slotDefault() },
		liveTicker: {
			visible: false,
			partners: true,
			speed: 90, // px / seconde
			messages: [
				'Bienvenue sur la KB SERIES — édition spéciale Epitech',
				'Suivez le tournoi sur #KBSERIES',
				'Finales en présentiel au Campus KB — Le Kremlin-Bicêtre',
			],
		},
		// Écran 50/50 = scène dédiée (pas de "visible") ; info = bandeau match en cours en bas au centre
		liveDualCam: { left: LIVE.camLabelDefault('A'), right: LIVE.camLabelDefault('B'), info: true, infoText: '' },
	};

	/** Complète une valeur : ancien format { visible, title, ... } → { left, center, right } ; emplacement manquant (ex. center) ajouté */
	LIVE.normalizeLowerThird = (v) => {
		if (!v || typeof v !== 'object') return JSON.parse(JSON.stringify(LIVE.defaults.liveLowerThird));
		if (LIVE.SIDE_KEYS.some((k) => v[k])) return Object.fromEntries(LIVE.SIDE_KEYS.map((k) => [k, { ...LIVE.slotDefault(), ...(v[k] || {}) }]));
		const old = {};
		for (const k of Object.keys(LIVE.slotDefault())) if (v[k] !== undefined) old[k] = v[k];
		return { left: { ...LIVE.slotDefault(), ...old }, center: LIVE.slotDefault(), right: LIVE.slotDefault() };
	};
	/** Valeur complète (les trois emplacements présents) ? */
	LIVE.isCompleteLowerThird = (v) => !!v && LIVE.SIDE_KEYS.every((k) => v[k] && typeof v[k] === 'object');

	LIVE.styles = {
		standard: { label: 'Standard', kicker: 'KB SERIES' },
		gold: { label: 'Annonce dorée', kicker: 'ANNONCE' },
		alert: { label: 'Alerte rouge', kicker: 'ALERTE' },
	};

	// ---------- Presets de lower third ----------
	// liveLowerThirdPresets = [{ id, name, style, kicker, title, subtitle, source, casterIndex, duration }]
	LIVE.presetFields = ['style', 'kicker', 'title', 'subtitle', 'source', 'casterIndex', 'duration'];
	/** Texte réellement affiché par un lower third (intervenant résolu, surtitre par défaut du style) → { style, kicker, title, subtitle } */
	LIVE.displayContent = (v, casters) => {
		const style = LIVE.styles[v && v.style] ? v.style : 'standard';
		let { title, subtitle, kicker } = v || {};
		if (v && v.source === 'caster') {
			const c = (casters || [])[+v.casterIndex || 0] || {};
			title = c.name || LIVE.roleLabel(c);
			subtitle = c.handle || '';
			kicker = kicker || LIVE.roleLabel(c);
		}
		return { style, title: title || '', subtitle: subtitle || '', kicker: kicker || LIVE.styles[style].kicker };
	};
	LIVE.defaults.liveLowerThirdPresets = [];
	LIVE.newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	/** Contenu d'un preset (sans id/name) → champs d'un slot */
	LIVE.presetContent = (p) => {
		const o = {};
		for (const k of LIVE.presetFields) o[k] = p[k] !== undefined ? p[k] : LIVE.slotDefault()[k];
		return o;
	};

	/** Presets automatiques (non modifiables) : chaque intervenant (host, casters), pause technique, prochain match. KB = window.KB */
	LIVE.autoPresets = (KB) => {
		const out = [];
		// Surtitre vide : le lower third affiche le rôle de l'intervenant (« Caster », « Host ») et suit ses changements
		((KB.rep.casters.value) || []).forEach((c, i) => out.push({
			id: 'auto:caster:' + i, auto: true, name: LIVE.roleLabel(c) + ' : ' + (c.name || i + 1),
			style: 'standard', kicker: '', title: c.name || '', subtitle: c.handle || '', source: 'caster', casterIndex: i, duration: 0,
		}));
		out.push({ id: 'auto:pause', auto: true, name: 'Pause technique', style: 'alert', kicker: '', title: 'Pause technique', subtitle: 'Reprise dans quelques instants', source: 'custom', casterIndex: 0, duration: 0 });
		out.push({ id: 'auto:next', auto: true, name: 'Prochain match', style: 'gold', kicker: 'Prochain match', ...LIVE.nextMatchText(KB), source: 'custom', casterIndex: 0, duration: 0 });
		return out;
	};

	LIVE.nextMatchText = (KB) => {
		const sched = KB.rep.schedule.value || [];
		const m = KB.rep.match.value || {};
		const next = sched.find((x) => x.status === 'upcoming');
		if (next) {
			const a = KB.team(next.teamA), b = KB.team(next.teamB);
			const vs = a || b ? `${a ? a.name : 'À définir'} vs ${b ? b.name : 'À définir'}` : next.label;
			return { title: vs, subtitle: [next.label !== vs ? next.label : '', next.time ? 'à ' + next.time : ''].filter(Boolean).join(' · ') };
		}
		const a = KB.team(m.teamA), b = KB.team(m.teamB);
		return { title: a && b ? `${a.name} vs ${b.name}` : 'Prochain match', subtitle: m.stage || '' };
	};

	/**
	 * Trous caméra de graphics/dual-cam.html, en px sur 1920×1080 (coins coupés haut-gauche / bas-droit, coupe = cut px).
	 * Chaque trou occupe une moitié d'écran (ratio ~1:1 : la webcam est recadrée dans OBS).
	 */
	LIVE.dualFrames = [
		{ x: 40, y: 40, w: 900, h: 860, cut: 30 },
		{ x: 980, y: 40, w: 900, h: 860, cut: 30 },
	];

	if (typeof module !== 'undefined' && module.exports) module.exports = LIVE;
	else root.LIVE = LIVE;
})(typeof window !== 'undefined' ? window : globalThis);
