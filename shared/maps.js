// Helpers partie "maps" (transition, map-intro, map-series, map-result, panneau maps-transitions)
// Navigateur : <script src="../shared/maps.js"></script> après kb.js → window.KBM
// Node       : require('../shared/maps.js') (valeurs par défaut : KBM.DEFAULT, KBM.TRANSITION_DEFAULT)
(function (root) {
	const KBM = {};

	KBM.DEFAULT = {
		intro: { visible: false, index: null },
		series: { visible: false },
		result: { visible: false, index: null, mvp: null, mvpTeam: null },
	};
	KBM.rep = () => (KBM._rep ||= nodecg.Replicant('mapsGraphics', { defaultValue: KBM.DEFAULT }));
	KBM.cfg = () => {
		const v = KBM.rep().value || {};
		return { intro: { ...KBM.DEFAULT.intro, ...(v.intro || {}) }, series: { ...KBM.DEFAULT.series, ...(v.series || {}) }, result: { ...KBM.DEFAULT.result, ...(v.result || {}) } };
	};

	// =====================================================================
	// Stinger (graphics/transition.html) — réglages + modèle géométrique
	// Replicant mapsTransitionSettings (toutes les durées en ms, à vitesse ×1) :
	//   coverIn    entrée : du 1er volet jusqu'à ce que le dernier (fond nuit + logo) soit en place
	//   holdLogo   tenue écran couvert, transition logo seul
	//   holdMap    tenue écran couvert, transition avec map
	//   holdReplay tenue écran couvert, transition replay (titre « REPLAY »)
	//   revealOut  sortie : du départ du 1er volet sortant jusqu'à la fin
	//   stagger    décalage entre deux volets
	//   speed      vitesse globale (×0,5 lent … ×3 rapide), divise toutes les durées
	//   direction  ltr | rtl | down | up | center | diag
	//   angle      inclinaison des bords des volets (degrés, 0 = droit)
	//   easing     smooth | linear | punchy | elastic
	//   panels     nombre de volets (le dernier = fond nuit qui porte logo / map)
	//   palette    theme | gold | red | team | mono   (couleurs des volets avant le fond)
	//   slashes    filets dorés qui traversent l'écran
	//   logoSize   taille du logo (px, logo seul ; ×0,57 avec map)
	//   logoAnim   pop | zoom | flip | fade      logoFlare : éclat + trait lumineux
	//   mapName / mapSplash / mapNumber / mapPick : éléments affichés pour une map
	//   mapZoom    intensité du zoom lent sur l'illustration (0 = fixe, 0,4 = fort)
	//   mapTitle   center | bottom | left (position du titre de map)
	//   presets    [{ name, settings }] préréglages enregistrés par l'utilisateur
	// =====================================================================
	KBM.TRANSITION_DEFAULT = {
		coverIn: 600, holdLogo: 360, holdMap: 2500, holdReplay: 900, revealOut: 540, stagger: 60, speed: 1,
		direction: 'ltr', angle: 20, easing: 'smooth', panels: 3, palette: 'theme', slashes: true,
		logoSize: 440, logoAnim: 'pop', logoFlare: true,
		mapName: true, mapSplash: true, mapNumber: true, mapPick: false, mapZoom: 0.14, mapTitle: 'center',
		presets: [],
	};
	KBM.TRANSITION_SCHEMA = {
		coverIn: { min: 100, max: 5000, step: 10 }, holdLogo: { min: 0, max: 20000, step: 50 }, holdMap: { min: 0, max: 20000, step: 50 }, holdReplay: { min: 0, max: 20000, step: 50 },
		revealOut: { min: 100, max: 5000, step: 10 }, stagger: { min: 0, max: 600, step: 5 }, speed: { min: 0.5, max: 3, step: 0.05, float: true },
		direction: { values: ['ltr', 'rtl', 'down', 'up', 'center', 'diag'] }, angle: { min: 0, max: 45, step: 1 },
		easing: { values: ['smooth', 'linear', 'punchy', 'elastic'] }, panels: { min: 1, max: 6, step: 1 },
		palette: { values: ['theme', 'gold', 'red', 'team', 'mono'] }, slashes: { bool: true },
		logoSize: { min: 120, max: 800, step: 10 }, logoAnim: { values: ['pop', 'zoom', 'flip', 'fade'] }, logoFlare: { bool: true },
		mapName: { bool: true }, mapSplash: { bool: true }, mapNumber: { bool: true }, mapPick: { bool: true },
		mapZoom: { min: 0, max: 0.4, step: 0.01, float: true }, mapTitle: { values: ['center', 'bottom', 'left'] },
	};
	const D = KBM.TRANSITION_DEFAULT;
	KBM.TRANSITION_PRESETS = {
		rapide: { label: 'Rapide', coverIn: 450, holdLogo: 200, holdMap: 1200, holdReplay: 500, revealOut: 420, stagger: 45 },
		normal: { label: 'Normal' },
		long: { label: 'Long sur la map', coverIn: 650, holdLogo: 500, holdMap: 4500, holdReplay: 1200, revealOut: 600, mapZoom: 0.22 },
		coupure: { label: 'Coupure nette', coverIn: 220, holdLogo: 150, holdMap: 1200, holdReplay: 400, revealOut: 220, stagger: 20, easing: 'linear', angle: 0, panels: 2, slashes: false, logoAnim: 'fade', logoFlare: false, mapZoom: 0.04 },
		cinema: { label: 'Cinématique', coverIn: 1400, holdLogo: 900, holdMap: 4000, holdReplay: 1800, revealOut: 1300, stagger: 180, easing: 'smooth', direction: 'down', angle: 6, panels: 4, palette: 'mono', logoAnim: 'fade', logoSize: 380, mapZoom: 0.3, mapTitle: 'bottom', mapPick: true },
		explosif: { label: 'Explosif', coverIn: 520, holdLogo: 500, holdMap: 2200, holdReplay: 1000, revealOut: 480, stagger: 70, easing: 'elastic', direction: 'center', angle: 25, panels: 5, palette: 'gold', logoAnim: 'zoom', logoSize: 520, mapPick: true },
	};
	// Types de transition : logo seul, logo + map, replay. Replicant `transition` : { at, map, kind? } (kind absent = ancien format)
	KBM.TR_KINDS = { logo: 'Logo seul', map: 'Logo + map', replay: 'Replay' };
	/** Type d'une transition : 'replay' | 'map' | 'logo'. Accepte une valeur du replicant transition, un type ou un booléen « avec map » */
	KBM.trKind = (v) => {
		if (v === 'replay' || v === 'map' || v === 'logo') return v;
		if (v && typeof v === 'object') return v.kind === 'replay' ? 'replay' : v.map ? 'map' : 'logo';
		return v ? 'map' : 'logo';
	};
	KBM.trRep = () => (KBM._trRep ||= nodecg.Replicant('mapsTransitionSettings', { defaultValue: KBM.TRANSITION_DEFAULT }));
	/** Réglages nettoyés (bornés, valeurs par défaut si absent, rétro-compatible). Sans argument : valeur du replicant. */
	KBM.trSettings = (v) => {
		if (v === undefined) v = KBM._trRep ? KBM._trRep.value : null;
		v = v || {};
		const out = {};
		for (const [k, sc] of Object.entries(KBM.TRANSITION_SCHEMA)) {
			const x = v[k];
			if (sc.values) out[k] = sc.values.includes(x) ? x : D[k];
			else if (sc.bool) out[k] = typeof x === 'boolean' ? x : D[k];
			else {
				const n = +x;
				out[k] = x != null && x !== '' && Number.isFinite(n) ? Math.min(sc.max, Math.max(sc.min, sc.float ? n : Math.round(n))) : D[k];
			}
		}
		out.presets = (Array.isArray(v.presets) ? v.presets : []).filter((p) => p && p.name).slice(0, 30)
			.map((p) => ({ name: String(p.name).slice(0, 40), settings: { ...KBM.trSettings({ ...p.settings, presets: [] }), presets: undefined } }));
		return out;
	};
	/** Applique un préréglage intégré (id) ou perso ({settings}) en gardant la liste perso */
	KBM.trApplyPreset = (current, preset) => {
		const base = { ...D, ...(preset.settings || preset) };
		delete base.label; delete base.presets;
		return KBM.trSettings({ ...base, presets: (current && current.presets) || [] });
	};

	// ---------- Courbes ----------
	const bezier = (x1, y1, x2, y2) => (x) => {
		if (x <= 0) return 0; if (x >= 1) return 1;
		let lo = 0, hi = 1, t = x;
		for (let i = 0; i < 22; i++) {
			t = (lo + hi) / 2;
			const cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
			if (cx < x) lo = t; else hi = t;
		}
		return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
	};
	KBM.EASE = {
		linear: (t) => Math.min(1, Math.max(0, t)),
		smooth: bezier(0.7, 0, 0.2, 1),
		punchy: (t) => { if (t <= 0) return 0; if (t >= 1) return 1; const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
		elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 9 - 0.75) * ((2 * Math.PI) / 3)) + 1),
		out: bezier(0.2, 0.8, 0.2, 1),
	};
	const W = 1920, H = 1080, PAD = 4;
	const prog = (t, start, dur, ease) => (t <= start ? 0 : ease(Math.min(1, (t - start) / Math.max(1, dur))));

	/** Polygone (points [x%, y%]) d'un volet entre la progression a (bord arrière) et b (bord avant) */
	function poly(dir, angle, a, b) {
		const tan = Math.tan((angle * Math.PI) / 180);
		if (dir === 'center') {
			const s = (tan * H / W) * 100, hMax = 50 + s / 2 + PAD, c = 50 - s / 2;
			const h = Math.max(0, b - a) * hMax;
			return [[c - h + s, 0], [c + h + s, 0], [c + h, 100], [c - h, 100]];
		}
		const vertical = dir === 'down' || dir === 'up';
		const s = dir === 'diag' ? (H / W) * (H / W) * 100 : (vertical ? tan * W / H : tan * H / W) * 100;
		const u0 = -s - PAD, u1 = 100 + PAD, pos = (p) => u0 + p * (u1 - u0);
		const lead = pos(b), trail = Math.min(lead, pos(a));
		const uv = [[trail + s, 0], [lead + s, 0], [lead, 100], [trail, 100]];
		const map = { ltr: ([u, v]) => [u, v], rtl: ([u, v]) => [100 - u, v], down: ([u, v]) => [v, u], up: ([u, v]) => [v, 100 - u], diag: ([u, v]) => [u, 100 - v] }[dir] || ((p) => p);
		return uv.map(map);
	}
	const covers = (pts) => {
		// L'écran (0..100)² est couvert si ses 4 coins sont dans le polygone convexe
		let area = 0;
		for (let i = 0; i < 4; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 4]; area += x1 * y2 - x2 * y1; }
		if (Math.abs(area) < 1) return false;
		const sg = Math.sign(area);
		for (const [cx, cy] of [[0, 0], [100, 0], [100, 100], [0, 100]]) {
			for (let i = 0; i < 4; i++) {
				const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 4];
				if (sg * ((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)) < -1e-6) return false;
			}
		}
		return true;
	};

	/**
	 * Modèle complet du stinger : timeline (ms réelles, vitesse incluse) + géométrie des volets à l'instant t.
	 * kind : 'logo' | 'map' | 'replay' (un booléen « avec map » est encore accepté, cf. KBM.trKind).
	 * { s, kind, hasMap, speed, duration, coveredFrom, coveredTo, coveredMs, cut, base:{...}, panelsAt(t), slashesAt(t) }
	 * coveredFrom / coveredTo sont calculés par simulation de la géométrie réelle (direction, angle, easing, décalage, vitesse).
	 */
	const modelCache = new Map();
	KBM.stingerModel = (settings, kind) => {
		kind = KBM.trKind(kind);
		const s = KBM.trSettings(settings === undefined ? undefined : settings || null);
		const key = JSON.stringify([s, kind].map((x) => (x && x.presets ? { ...x, presets: 0 } : x)));
		if (modelCache.has(key)) return modelCache.get(key);
		const ease = KBM.EASE[s.easing] || KBM.EASE.smooth;
		const n = s.panels, st = n > 1 ? s.stagger : 0;
		const hold = s[{ logo: 'holdLogo', map: 'holdMap', replay: 'holdReplay' }[kind]];
		const inDur = Math.max(60, s.coverIn - (n - 1) * st);
		const outDur = Math.max(60, s.revealOut - (n - 1) * st);
		const exitAt = s.coverIn + hold;
		const panels = Array.from({ length: n }, (_, i) => ({ inStart: i * st, inDur, outStart: exitAt + (n - 1 - i) * st, outDur }));
		const linear = s.direction !== 'center';
		const sl1 = { start: 0.27 * s.coverIn, dur: Math.max(120, 0.93 * s.coverIn) };
		const sl2 = { start: Math.max(0, exitAt - 0.04 * s.revealOut), dur: Math.max(120, s.revealOut) };
		const endBase = Math.max(exitAt + s.revealOut, ...panels.map((p) => p.outStart + p.outDur), s.slashes && linear ? sl2.start + sl2.dur : 0);
		const panelsAtBase = (tb) => panels.map((p) => poly(s.direction, s.angle, prog(tb, p.outStart, p.outDur, ease), prog(tb, p.inStart, p.inDur, ease)));
		const slashesAtBase = (tb) => {
			if (!s.slashes || !linear) return [];
			const w1 = 0.022, w2 = 0.012;
			const p1 = tb <= sl1.start ? -1 : prog(tb, sl1.start, sl1.dur, ease) * (1 + w1);
			const p2 = tb <= sl2.start ? -1 : prog(tb, sl2.start, sl2.dur, ease) * (1 + w2);
			return [p1 < 0 ? null : poly(s.direction, s.angle, p1 - w1, p1), p2 < 0 ? null : poly(s.direction, s.angle, p2 - w2, p2)];
		};
		// Simulation de la couverture (pas de 4 ms en temps de base)
		let best = null, cur = null;
		for (let tb = 0; tb <= endBase + 4; tb += 4) {
			const ok = panelsAtBase(tb).some(covers);
			if (ok && !cur) cur = { from: tb, to: tb };
			if (ok) cur.to = tb;
			if (!ok && cur) { if (!best || cur.to - cur.from > best.to - best.from) best = cur; cur = null; }
		}
		if (cur && (!best || cur.to - cur.from > best.to - best.from)) best = cur;
		const sp = s.speed;
		const coveredFrom = best ? Math.ceil(best.from / sp) : 0, coveredTo = best ? Math.floor(best.to / sp) : 0;
		const k = s.coverIn / 600, r = s.revealOut / 540;
		const m = {
			s, kind, hasMap: kind === 'map', speed: sp, hold, k, r,
			base: { inDur, outDur, exitAt, end: endBase, panels },
			coverIn: Math.round(s.coverIn / sp), revealOut: Math.round(s.revealOut / sp), exitAt: Math.round(exitAt / sp),
			duration: Math.ceil(endBase / sp),
			coveredFrom, coveredTo, coveredMs: Math.max(0, coveredTo - coveredFrom), covered: !!best,
			cut: best ? Math.round((coveredFrom + coveredTo) / 2) : Math.round(exitAt / sp),
			panelsAt: (t) => panelsAtBase(t * sp),
			slashesAt: (t) => slashesAtBase(t * sp),
		};
		if (modelCache.size > 50) modelCache.clear();
		modelCache.set(key, m);
		return m;
	};
	/** Compat : timings (duration, coveredFrom, coveredTo, coveredMs, cut…) */
	KBM.stingerTiming = (settings, kind) => KBM.stingerModel(settings, kind);
	KBM.STINGER = (() => { const t = KBM.stingerModel(D, 'logo'); return { duration: t.duration, coveredFrom: t.coveredFrom, coveredTo: t.coveredTo, cut: t.cut, point: t.cut }; })();

	/** Entrée de match.maps à l'index donné (null/undefined = currentMap). { entry, index, number, total } ou null */
	KBM.mapAt = (index, match = KB.rep.match.value) => {
		const maps = (match && match.maps) || [];
		let i = index == null || index === '' ? match && match.currentMap : +index;
		if (!Number.isInteger(i) || i < 0 || i >= maps.length) i = maps.length ? Math.min(Math.max(0, i | 0), maps.length - 1) : -1;
		if (i < 0) return null;
		const total = Math.max(maps.length, ({ bo1: 1, bo3: 3, bo5: 5 }[match.format] || maps.length));
		return { entry: maps[i], index: i, number: i + 1, total };
	};

	/** 'A'|'B' → objet équipe */
	KBM.teamOf = (key, match = KB.rep.match.value) => (key === 'A' ? KB.team(match && match.teamA) : key === 'B' ? KB.team(match && match.teamB) : null);

	/** Étape de veto (pick/decider) pour une map */
	KBM.vetoStep = (mapName) => {
		const v = KB.rep.veto.value;
		return (v && v.steps || []).find((s) => s && s.map === mapName && (s.action === 'pick' || s.action === 'decider')) || null;
	};

	/** Côtés de départ { A: 'attack'|'defense', B: ... } ou null */
	KBM.startSides = (mapName) => {
		const s = KBM.vetoStep(mapName);
		if (!s || !s.side || (s.sideTeam !== 'A' && s.sideTeam !== 'B')) return null;
		const other = s.side === 'attack' ? 'defense' : 'attack';
		return s.sideTeam === 'A' ? { A: s.side, B: other } : { A: other, B: s.side };
	};
	KBM.sideLabel = (side) => ({ attack: 'Attaque', defense: 'Défense' }[side] || '–');

	/** Vainqueur effectif d'une map (winner, sinon null) */
	KBM.winnerOf = (e) => (e && (e.winner === 'A' || e.winner === 'B') ? e.winner : null);

	/** Pourcentage propre : "57.1%" / 57.14 → "57%" */
	KBM.pct = (v) => { const n = parseFloat(v); return isNaN(n) ? '–' : Math.round(n) + '%'; };
	KBM.dec = (v, d = 2) => { const n = parseFloat(v); return isNaN(n) ? '–' : n.toFixed(d); };

	/**
	 * Anime les données qui changent : chaque élément [data-k] dont data-v (ou le texte) diffère du rendu précédent
	 * reçoit .kbm-chg — seulement quand la scène est installée (pas pendant l'entrée).
	 */
	KBM.flashChanges = (root, store) => {
		const settled = root.classList.contains('kb-settled');
		root.querySelectorAll('[data-k]').forEach((el) => {
			const k = el.dataset.k, v = el.dataset.v ?? el.textContent;
			if (settled && store.has(k) && store.get(k) !== v) {
				// Le nœud est réutilisé d'un rendu à l'autre (KBM.patch) : on rejoue le flash puis on retire la classe,
				// sinon elle écraserait l'entrée .kb-anim au prochain affichage
				KB.restart(el, 'kbm-chg');
				el.addEventListener('animationend', function done(e) {
					if (e.target === el && e.animationName === 'kbm-chg') { el.classList.remove('kbm-chg'); el.removeEventListener('animationend', done); }
				});
			}
			store.set(k, v);
		});
	};

	// Classes posées après coup sur un nœud (flash en cours) : KBM.patch ne les retire pas
	const TRANSIENT = ['kbm-chg'];
	const sameShape = (a, b) => a.childNodes.length === b.childNodes.length && [...a.childNodes].every((n, i) => {
		const m = b.childNodes[i];
		return n.nodeType === m.nodeType && n.nodeName === m.nodeName && (n.nodeType !== 1 || sameShape(n, m));
	});
	const syncNode = (a, b) => {
		a.childNodes.forEach((n, i) => {
			const m = b.childNodes[i];
			if (n.nodeType === 3) { if (n.nodeValue !== m.nodeValue) n.nodeValue = m.nodeValue; return; }
			if (n.nodeType !== 1) return;
			for (const { name } of [...n.attributes]) if (!m.hasAttribute(name)) n.removeAttribute(name);
			for (const { name, value } of [...m.attributes]) {
				const v = name === 'class' ? [value, ...TRANSIENT.filter((c) => n.classList.contains(c))].join(' ') : value;
				if (n.getAttribute(name) !== v) n.setAttribute(name, v);
			}
			syncNode(n, m);
		});
	};
	/**
	 * Met à jour le contenu de root avec html SANS reconstruire les nœuds quand la structure est la même
	 * (mêmes balises, même imbrication) et que `key` n'a pas changé : seuls textes et attributs sont modifiés,
	 * les animations en cours (boucles, entrées) continuent. Sinon, reconstruit tout. Renvoie true si reconstruit.
	 * Ex. KBM.patch($('#content'), html, mapName)
	 */
	KBM.patch = (root, html, key = '') => {
		const tpl = document.createElement('template');
		tpl.innerHTML = html;
		if (root.dataset.patchKey !== String(key) || !sameShape(root, tpl.content)) {
			root.replaceChildren(tpl.content);
			root.dataset.patchKey = key;
			return true;
		}
		syncNode(root, tpl.content);
		return false;
	};

	/** Valeur CSS url("…") sûre pour une adresse venant d'un replicant (style.backgroundImage, attribut style après KB.esc) */
	KBM.cssUrl = (u) => 'url("' + String(u ?? '').replace(/[\r\n]/g, '').replace(/["\\]/g, '\\$&') + '")';

	/** Stat d'un joueur (KB.player) en texte court, ou '–' */
	KBM.stat = (p, key, digits) => {
		const s = p && p.stats && p.stats[key];
		if (!s || (s.display == null && s.value == null)) return '–';
		if (digits != null && s.value != null && !isNaN(s.value)) return (+s.value).toFixed(digits);
		return String(s.display ?? s.value);
	};

	/** Précharge des images (splash du stinger) */
	KBM.preload = (urls) => { for (const u of urls) if (u) { const i = new Image(); i.src = u; } };

	if (typeof module !== 'undefined' && module.exports) module.exports = KBM;
	else root.KBM = KBM;
})(typeof window !== 'undefined' ? window : globalThis);
