// Partie "scenes" — valeurs par défaut + helpers communs aux écrans plein écran (starting, brb, ending, schedule).
// Utilisable côté Node (extension/scenes.js : require('../shared/scenes.js').DEFAULT_TEXTS)
// et côté navigateur (<script src="../shared/scenes.js"></script> après kb.js) → window.KBScenes
(function (root) {
	// Replicant `scenesTexts` : textes personnalisables des écrans
	const DEFAULT_TEXTS = {
		marquee: 'Présenté par CYCOM • KB SERIES × Epitech • Tournoi Valorant 5v5',
		countdownZero: "C'est parti",
		starting: { title: 'Bientôt', fallback: 'Le stream commence bientôt', showNextMatch: true },
		brb: { kicker: 'On revient très vite', title: 'Pause', message: 'Restez connectés, la suite arrive !', countdownLabel: 'Reprise dans', showCountdown: true, showSeries: true },
		ending: { kicker: 'Fin du stream', title: "Merci d'avoir suivi", message: 'Bravo à toutes les équipes et merci au public !', nextLabel: 'Prochain rendez-vous', next: 'Phase finale le 14/11 au Campus KB' },
		schedule: { kicker: 'Programme du jour', title: 'Planning' },
	};

	// Replicant `scenesRotation` : bandeau d'infos en rotation de l'écran Pause (V2)
	//   items[] : { id, type: 'text'|'nextMatch'|'upcoming'|'series'|'tournament', enabled, duration (s),
	//               label (titre du badge, optionnel), kicker, title, subtitle (pour 'text') }
	const ROTATION_TYPES = {
		text: { name: 'Texte libre', kicker: 'Info', label: 'À savoir' },
		nextMatch: { name: 'Prochain match', kicker: 'Ensuite', label: 'Prochain match' },
		upcoming: { name: 'Planning à venir', kicker: 'Au programme', label: 'À suivre' },
		series: { name: 'Score de la série', kicker: 'Série en cours', label: 'Le score' },
		tournament: { name: 'Infos tournoi', kicker: 'KB SERIES', label: 'Le tournoi' },
	};
	const DEFAULT_ROTATION = {
		items: [
			{ id: 'r1', type: 'upcoming', enabled: true, duration: 10 },
			{ id: 'r2', type: 'nextMatch', enabled: true, duration: 8 },
			{ id: 'r3', type: 'series', enabled: true, duration: 8 },
			{ id: 'r4', type: 'text', enabled: true, duration: 8, kicker: 'Rejoignez-nous', label: 'Phase finale', title: 'Le 14/11 au Campus KB', subtitle: 'Demi-finales, petite finale et grande finale en présentiel' },
			{ id: 'r5', type: 'tournament', enabled: true, duration: 8 },
		],
	};

	if (typeof module !== 'undefined' && module.exports) { module.exports = { DEFAULT_TEXTS, DEFAULT_ROTATION, ROTATION_TYPES }; return; }

	const KB = root.KB;
	const S = { DEFAULT_TEXTS, DEFAULT_ROTATION, ROTATION_TYPES };

	const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
	const merge = (def, val) => {
		if (!isObj(def)) return val === undefined || val === null ? def : val;
		const out = {};
		for (const k of new Set([...Object.keys(def), ...Object.keys(isObj(val) ? val : {})])) out[k] = merge(def[k], isObj(val) ? val[k] : undefined);
		return out;
	};

	S.rep = nodecg.Replicant('scenesTexts', { defaultValue: DEFAULT_TEXTS });
	/** Textes fusionnés avec les valeurs par défaut (rétro-compatible si des champs manquent) */
	S.texts = () => merge(DEFAULT_TEXTS, S.rep.status === 'declared' ? S.rep.value : undefined);

	S.rotRep = nodecg.Replicant('scenesRotation', { defaultValue: DEFAULT_ROTATION });
	/** Éléments de rotation (valeur par défaut si replicant vide/ancien) */
	S.rotation = () => {
		const v = S.rotRep.status === 'declared' ? S.rotRep.value : null;
		const items = v && Array.isArray(v.items) ? v.items : DEFAULT_ROTATION.items;
		return items.filter((it) => it && ROTATION_TYPES[it.type]).map((it, i) => ({ ...it, id: it.id || 'r' + i, enabled: it.enabled !== false, duration: Math.max(3, Number(it.duration) || 8) }));
	};

	const T = () => (KB.rep.tournament.status === 'declared' && KB.rep.tournament.value) || {};
	S.tournament = T;

	/** Remplit un bandeau .kb-marquee (le contenu est doublé pour la boucle -50%) */
	S.marquee = (el, text) => {
		const items = String(text || '').split(/[•·|]/).map((s) => s.trim()).filter(Boolean);
		if (!items.length) items.push('KB SERIES');
		let line = [];
		while (line.join('').length < 160) line = line.concat(items);
		const half = line.map((s) => `<span>${KB.esc(s)}</span>`).join('');
		const key = JSON.stringify(items);
		if (el.dataset.key === key) return;
		el.dataset.key = key;
		el.innerHTML = `<div class="kb-marquee__track">${half}${half}</div>`;
	};

	/** Nom d'équipe propre */
	S.teamName = (team, fallback = 'À déterminer') => (team && (team.name || team.tag)) || fallback;

	/** Ajuste la police de tous les [data-fit] d'un conteneur (data-fit = taille minimale en px) */
	S.fitAll = (root, min = 14) => KB.$$('[data-fit]', root).forEach((el) => KB.fit(el, { min: +el.dataset.fit || min, height: true }));

	/**
	 * Compte à rebours branché sur le replicant coeur `countdown`.
	 * onTick({ state: 'none'|'running'|'zero', text, ms, label })
	 */
	S.countdown = (onTick) => {
		let last = '';
		const tick = () => {
			if (KB.rep.countdown.status !== 'declared') return;
			const cd = KB.rep.countdown.value || {};
			let st;
			if (!cd.endsAt) st = { state: 'none', text: '', ms: 0 };
			else {
				const ms = cd.endsAt - Date.now();
				st = ms > 0 ? { state: 'running', text: KB.formatCountdown(ms), ms } : { state: 'zero', text: S.texts().countdownZero || "C'est parti", ms: 0 };
			}
			st.label = cd.label || '';
			const key = st.state + st.text + st.label;
			if (key !== last) { last = key; onTick(st); }
		};
		setInterval(tick, 200);
		KB.rep.countdown.on('change', tick);
		S.rep.on('change', () => { last = ''; tick(); });
		return { refresh() { last = ''; tick(); } };
	};

	/** Prochain match : `match` en priorité, sinon 1er match live/à venir du planning avec deux équipes (diffusé de préférence) */
	S.nextMatch = () => {
		const m = KB.rep.match.value;
		if (m && (m.teamA || m.teamB)) {
			const s = KB.sides(m);
			return { left: s.left, right: s.right, stage: m.stage, format: KB.formatLabel(m.format), source: 'match' };
		}
		const rows = (KB.rep.schedule.value || []).filter((r) => r.status !== 'done' && (r.teamA || r.teamB));
		const row = rows.find((r) => r.streamed !== false) || rows[0]; // le prochain match diffusé d'abord
		if (row) return { left: KB.team(row.teamA), right: KB.team(row.teamB), stage: row.label, format: row.time || '', source: 'schedule' };
		return null;
	};

	/** Bande partenaires (Présenté par CYCOM · Édition spéciale EPITECH) */
	S.partnersHTML = () => `
		<div class="sc-partner"><span class="kb-label">Présenté par</span><img src="${KB.img.cycom}" alt="CYCOM" class="sc-cycom"></div>
		<i class="sc-partner-sep"></i>
		<div class="sc-partner"><span class="kb-label">Édition spéciale</span><img src="${KB.img.epitech}" alt="EPITECH" class="sc-epitech"></div>`;

	S.calendarSVG = (size = 64) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
		<rect x="5" y="11" width="54" height="47" rx="8" stroke="currentColor" stroke-width="5"/>
		<path d="M5 24h54" stroke="currentColor" stroke-width="5"/><path d="M19 5v12M45 5v12" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
		<g fill="currentColor"><rect x="14" y="31" width="7" height="6" rx="1"/><rect x="25" y="31" width="7" height="6" rx="1"/><rect x="36" y="31" width="7" height="6" rx="1"/><rect x="14" y="42" width="7" height="6" rx="1"/><rect x="25" y="42" width="7" height="6" rx="1"/></g>
		<path d="M38 45l4 4 8-9" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

	/** Joue l'entrée d'un conteneur une fois les polices chargées (ou après 1,5 s max) */
	S.enter = (el) => {
		const go = () => { if (el.classList.contains('kb-in')) return; void el.offsetWidth; el.classList.add('kb-in'); };
		Promise.race([document.fonts.ready, KB.sleep(1500)]).then(go);
	};

	/** Prochain match "à venir" du planning (hors match en cours, diffusé de préférence) */
	S.upcomingMatch = () => {
		const rows = (KB.rep.schedule.value || []).filter((r) => r.status === 'upcoming' || !r.status);
		const row = rows.find((r) => r.streamed !== false) || rows[0]; // le prochain match diffusé d'abord
		return row ? { left: KB.team(row.teamA), right: KB.team(row.teamB), stage: row.label, time: row.time || '' } : null;
	};

	// ---------- V2 : ambiance animée ----------
	const rnd = (seed) => { let x = seed; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
	const starShadows = (n, size, color, seed) => {
		const r = rnd(seed); const out = [];
		for (let i = 0; i < n; i++) out.push(`${Math.round(r() * 2040 - 60)}px ${Math.round(r() * 1180 - 50)}px 0 ${size}px ${color}`);
		return out.join(',');
	};
	const SPARK = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor"/></svg>';
	/**
	 * Ajoute l'ambiance : étoiles qui dérivent/scintillent (3 couches), étincelles, étoiles filantes,
	 * balayages dorés sur le cadre (.sc-frame), flash d'entrée. after = élément après lequel insérer les étoiles.
	 */
	S.ambient = (stage, { after, sparks = 9 } = {}) => {
		const amb = document.createElement('div');
		amb.className = 'sc-amb';
		amb.innerHTML = `<i class="layer l1" style="box-shadow:${starShadows(110, .4, 'rgba(207,227,255,.8)', 7)}"></i>
			<i class="layer l2" style="box-shadow:${starShadows(55, .8, 'rgba(255,255,255,.9)', 31)}"></i>
			<i class="layer l3" style="box-shadow:${starShadows(18, 1.3, '#fff', 97)}"></i>
			<i class="shoot"></i><i class="shoot s2"></i>`;
		const r = rnd(1234);
		for (let i = 0; i < sparks; i++) {
			const sp = document.createElement('i');
			sp.className = 'spark';
			sp.innerHTML = SPARK;
			sp.style.cssText = `left:${Math.round(80 + r() * 1760)}px;top:${Math.round(70 + r() * 940)}px;--t:${(6 + r() * 6).toFixed(1)}s;--dl:${(r() * 8).toFixed(1)}s;transform:scale(${(.5 + r() * .7).toFixed(2)})`;
			amb.appendChild(sp);
		}
		const ref = after || KB.$('.kb-bg', stage);
		if (ref && ref.parentNode === stage) ref.after(amb); else stage.prepend(amb);
		KB.$$('.sc-frame', stage).forEach((f) => f.insertAdjacentHTML('beforeend', ['top', 'right', 'bottom', 'left'].map((d) => `<span class="sc-sweep sc-sweep--${d}"><i></i></span>`).join('')));
		stage.insertAdjacentHTML('beforeend', '<div class="sc-flash"></div>');
		return amb;
	};

	/** Entoure un logo <img> d'un reflet qui passe (masqué par la forme du logo) + lévitation */
	S.shineLogo = (img) => {
		if (!img || img.parentNode.classList.contains('sc-shine-wrap')) return;
		const wrap = document.createElement('span');
		wrap.className = 'sc-shine-wrap ' + (img.className.match(/kb-anim[\w-]*/g) || []).join(' ');
		wrap.style.cssText = img.style.cssText;
		img.className = img.className.replace(/kb-anim[\w-]*/g, '').trim();
		img.style.cssText = '';
		img.parentNode.insertBefore(wrap, img);
		wrap.appendChild(img);
		const sh = document.createElement('i');
		sh.className = 'sc-shine';
		const url = `url("${img.getAttribute('src')}")`;
		sh.style.webkitMaskImage = url; sh.style.maskImage = url;
		wrap.appendChild(sh);
		return wrap;
	};

	/** Rejoue un "pop" lumineux sur un élément (changement de donnée) */
	S.bump = (el) => KB.restart(el, 'sc-bump');
	/** Met à jour un texte et anime s'il a changé (pas au premier rendu) */
	S.setText = (el, txt) => {
		if (!el) return;
		txt = String(txt ?? '');
		if (el.textContent === txt) return;
		const first = !el.dataset.scSet;
		el.textContent = txt; el.dataset.scSet = '1';
		if (!first) S.bump(el);
	};
	/** Garde une "signature" par clé et renvoie true si elle a changé depuis le dernier appel (false au 1er) */
	const sigs = new Map();
	S.changed = (key, value) => {
		const v = JSON.stringify(value);
		const had = sigs.has(key), prev = sigs.get(key);
		sigs.set(key, v);
		return had && prev !== v;
	};

	/** Statut d'une ligne de planning */
	S.statusLabel = (st) => ({ done: 'Terminé', live: 'En cours', upcoming: 'À venir' }[st] || 'À venir');

	root.KBScenes = S;
})(typeof window !== 'undefined' ? window : globalThis);
