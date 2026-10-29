// Helpers partagés graphics + dashboard. Import : <script src="../shared/kb.js"></script> (après le script nodecg injecté)
// Expose window.KB
(function () {
	const KB = {};

	KB.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
	KB.$ = (sel, root = document) => root.querySelector(sel);
	KB.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
	KB.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	/** Copie profonde d'une valeur JSON (replicant…) ; undefined reste undefined. */
	KB.clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
	/** Assemble des morceaux de texte avec « · » en ignorant les vides (pas de séparateur orphelin). */
	KB.joinDot = (...parts) => parts.filter(Boolean).join(' · ');

	// Assets du bundle (logos de l'affiche) — chemins valides depuis graphics/ et dashboard/
	KB.img = {
		kbs: '../shared/img/kbs-logo.png',
		cycom: '../shared/img/cycom-alpha.png',
		epitech: '../shared/img/epitech-alpha.png',
		posterArt: '../shared/img/poster-art.webp',
	};

	// Replicants coeur (déclarés dans extension/state.js, valeurs par défaut dans shared/defaults.js)
	KB.rep = {};
	for (const name of ['tournament', 'teams', 'match', 'veto', 'casters', 'schedule', 'countdown', 'transition', 'streamScene', 'valorantData', 'playerProfiles', 'playerData']) {
		Object.defineProperty(KB.rep, name, { get() { return (this['_' + name] ||= nodecg.Replicant(name)); } });
	}

	/**
	 * Attend des replicants puis appelle render à chaque changement de l'un d'eux (render groupé par frame).
	 * Le rendu part à la prochaine image, ou au plus tard après 50 ms : un navigateur qui ralentit ou suspend ses images
	 * (source vMix / OBS jugée hors écran, onglet en arrière-plan) appliquerait sinon la commande avec retard, voire pas du tout.
	 */
	KB.watch = (names, render) => {
		const reps = names.map((n) => (typeof n === 'string' ? KB.rep[n] || nodecg.Replicant(n) : n));
		let queued = false, raf = 0, timer = 0;
		const run = () => { if (!queued) return; queued = false; cancelAnimationFrame(raf); clearTimeout(timer); render(); };
		const schedule = () => { if (queued) return; queued = true; raf = requestAnimationFrame(run); timer = setTimeout(run, 50); };
		NodeCG.waitForReplicants(...reps).then(() => { reps.forEach((r) => r.on('change', schedule)); schedule(); });
		return reps;
	};

	// ---------- Équipes / match ----------
	KB.team = (id) => (id && KB.rep.teams.value && KB.rep.teams.value[id]) || null;

	/** Équipes gauche/droite en tenant compte de match.swap. Renvoie { left, right, leftKey: 'A'|'B', rightKey } */
	KB.sides = (match = KB.rep.match.value) => {
		const A = KB.team(match && match.teamA), B = KB.team(match && match.teamB);
		return match && match.swap
			? { left: B, right: A, leftKey: 'B', rightKey: 'A' }
			: { left: A, right: B, leftKey: 'A', rightKey: 'B' };
	};

	/** Score de la série { A, B } calculé depuis match.maps[].winner */
	KB.seriesScore = (match = KB.rep.match.value) => {
		const s = { A: 0, B: 0 };
		for (const m of (match && match.maps) || []) if (m.winner === 'A' || m.winner === 'B') s[m.winner]++;
		return s;
	};
	KB.winsNeeded = (format) => ({ bo1: 1, bo3: 2, bo5: 3 }[format] || 1);
	KB.formatLabel = (format) => ({ bo1: 'BO1', bo3: 'BO3', bo5: 'BO5' }[format] || String(format || '').toUpperCase());

	// Couleurs d'équipe par défaut (mêmes valeurs que --team-a / --team-b de theme.css, que les panneaux ne chargent pas)
	KB.TEAM_COLORS = { A: '#3b8fe6', B: '#ff4655' };
	/** Couleur d'une équipe, sinon la couleur par défaut de son côté. Ex. KB.teamColor(KB.team(m.teamB), 'B') */
	KB.teamColor = (team, key) => (team && /^#[0-9a-f]{3,8}$/i.test(team.color) ? team.color : key === 'B' ? KB.TEAM_COLORS.B : KB.TEAM_COLORS.A);

	/** Liste ordonnée des équipes : celles du match en premier, puis par nom */
	KB.orderedTeams = () => {
		const teams = Object.values(KB.rep.teams.value || {});
		const m = KB.rep.match.value;
		const prio = [m && m.teamA, m && m.teamB];
		return teams.sort((a, b) => {
			const pa = prio.indexOf(a.id), pb = prio.indexOf(b.id);
			return (pa < 0 ? 9 : pa) - (pb < 0 ? 9 : pb) || String(a.name).localeCompare(String(b.name));
		});
	};

	/** HTML du logo d'équipe (img) ou monogramme si pas de logo. size en px */
	KB.teamLogo = (team, size = 80) => {
		if (!team) return `<div class="kb-team-mono" style="width:${size}px;height:${size}px;font-size:${size * 0.4}px">?</div>`;
		if (team.logo) return `<img class="kb-team-logo" src="${KB.esc(team.logo)}" style="width:${size}px;height:${size}px" alt="">`;
		const mono = (team.tag || team.name || '?').slice(0, 3).toUpperCase();
		return `<div class="kb-team-mono" style="--c:${KB.esc(KB.teamColor(team))};width:${size}px;height:${size}px;font-size:${size * 0.32}px">${KB.esc(mono)}</div>`;
	};

	// ---------- Données Valorant ----------
	const vd = () => KB.rep.valorantData.value || {};
	KB.map = (name) => (name && vd().maps && vd().maps[name]) || null;
	KB.agent = (name) => (name && vd().agents && vd().agents[name]) || null;
	KB.mapNames = () => Object.keys(vd().maps || {}).sort();

	/** Profil tracker brut d'un joueur à partir de son Riot ID (préférer KB.player, qui fusionne la saisie manuelle) */
	KB.profile = (riotId) => (riotId && KB.rep.playerProfiles.value && KB.rep.playerProfiles.value[String(riotId).toLowerCase()]) || null;

	/** Adresse du profil tracker.gg d'un Riot ID (« Nom#TAG ») */
	KB.trackerUrl = (riotId) => 'https://tracker.gg/valorant/profile/riot/' + encodeURIComponent(riotId) + '/overview';

	// ---------- Joueurs (vue fusionnée tracker + saisie manuelle) ----------
	KB.key = (riotId) => (riotId ? String(riotId).trim().toLowerCase() : '');

	// Rôles possibles d'un joueur : clé (minuscules, comparée sans casse) → libellé affiché
	KB.ROLES = {
		duelist: 'Duelliste', initiator: 'Initiateur', controller: 'Contrôleur', sentinel: 'Sentinelle',
		flex: 'Flex', igl: 'IGL', sub: 'Remplaçant', coach: 'Coach',
	};
	/** Libellé français d'un rôle ('Duelist' → 'Duelliste') ; un rôle inconnu est rendu tel quel */
	KB.roleLabel = (r) => (r ? KB.ROLES[String(r).toLowerCase()] || String(r) : '');

	/** Détail d'un agent depuis valorantData (+ couleur principale) ou null */
	KB.agentInfo = (name) => {
		const a = KB.agent(name);
		if (!a) return null;
		const c = a.colors && a.colors[0];
		return { ...a, color: c ? '#' + c.slice(0, 6) : null };
	};

	/** Équipe + rôle d'un joueur d'après son riotId */
	KB.teamOf = (riotId) => {
		const k = KB.key(riotId);
		if (!k) return null;
		for (const t of Object.values(KB.rep.teams.value || {})) {
			const p = (t.players || []).find((x) => x && KB.key(x.riotId) === k);
			if (p) return { team: t, role: p.role || '' };
		}
		return null;
	};

	/**
	 * Joueur fusionné : profil tracker.gg (playerProfiles) + saisie manuelle (playerData) qui prime.
	 * { key, riotId, name, tag, realName, photo, team, role, rank, peak, level, stats, agents, hasTracker, manual, profile }
	 *  - stats[k] = { display, value, percentile, manual }  (mêmes clés que tracker : kd, acs, adr, hs, kast, winPct, wins, losses, matches, firstBloods, clutches, aces...)
	 *  - agents = [{ name, icon, portrait, bust, role, color, matches, winPct, kd }] (manuel prioritaire)
	 */
	KB.player = (riotId) => {
		const key = KB.key(riotId);
		if (!key) return null;
		const prof = KB.profile(key);
		const data = (KB.rep.playerData.value || {})[key] || {};
		const ov = data.overrides || {};
		const rid = data.riotId || (prof && prof.riotId) || String(riotId);
		const [n, t] = rid.split('#');
		const tm = KB.teamOf(rid);

		const stats = {};
		for (const [k, v] of Object.entries((prof && prof.stats) || {})) stats[k] = { ...v, manual: false };
		for (const [k, v] of Object.entries(ov.stats || {})) {
			if (v === '' || v == null) continue;
			const num = parseFloat(String(v).replace(',', '.'));
			stats[k] = { display: String(v), value: isNaN(num) ? null : num, percentile: null, manual: true };
		}

		let agents;
		if (ov.agents && ov.agents.filter(Boolean).length) {
			agents = ov.agents.filter(Boolean).map((name) => {
				const tr = prof && (prof.agents || []).find((a) => a.name === name);
				const info = KB.agentInfo(name) || {};
				return { ...(tr || {}), ...info, name, color: (tr && tr.color) || info.color, manual: true };
			});
		} else {
			agents = ((prof && prof.agents) || []).map((a) => ({ ...(KB.agentInfo(a.name) || {}), ...a }));
		}

		return {
			key, riotId: rid,
			name: data.displayName || (prof && prof.name) || n,
			tag: (prof && prof.tag) || t || '',
			realName: data.realName || '',
			photo: data.photo || null,
			team: tm ? tm.team : null,
			role: tm ? tm.role : '',
			rank: ov.rank && ov.rank.name ? ov.rank : (prof && prof.rank) || null,
			peak: ov.peak && ov.peak.name ? ov.peak : (prof && prof.peak) || null,
			level: prof && prof.level,
			season: prof && prof.season,
			stats, agents, maps: (prof && prof.maps) || [],
			roles: (prof && prof.roles) || [], // stats par rôle tracker.gg (extension/tracker.js), plus joué d'abord
			hasTracker: !!prof,
			// Vrai seulement si une saisie manuelle non vide existe (le panneau enregistre des champs vides)
			manual: Object.values(ov.stats || {}).some((v) => v !== '' && v != null) || (ov.agents || []).some(Boolean)
				|| !!(ov.rank && ov.rank.name) || !!(ov.peak && ov.peak.name),
			profile: prof || null,
		};
	};

	/** Roster fusionné d'une équipe : tous les joueurs ayant un Riot ID, dans l'ordre (titulaires puis remplaçants) */
	KB.roster = (team) => ((team && team.players) || []).filter((p) => p && p.riotId).map((p) => KB.player(p.riotId));

	/** Agent joué par un joueur sur une map du match (index par défaut = map courante) → agentInfo ou null */
	KB.pickOf = (riotId, mapIndex) => {
		const m = KB.rep.match.value || {};
		const i = mapIndex == null ? m.currentMap : mapIndex;
		const picks = (m.maps && m.maps[i] && m.maps[i].picks) || {};
		const name = picks[KB.key(riotId)];
		return name ? KB.agentInfo(name) || { name } : null;
	};

	// ---------- Animation ----------
	/**
	 * Gère l'entrée/sortie d'un conteneur avec les classes .kb-in / .kb-out (voir theme.css).
	 * show() relance les animations, hide() joue la sortie. outMs = durée de la sortie.
	 * Masqué, l'élément porte .kb-idle : ses boucles d'ambiance sont en pause (toutes les iframes de stream.html
	 * partagent un seul fil d'exécution, inutile d'animer ce qui ne se voit pas).
	 */
	KB.presence = (el, outMs = 450) => {
		let visible = false, gen = 0;
		const cs = getComputedStyle(el);
		if (cs.visibility === 'hidden' || cs.display === 'none') el.classList.add('kb-idle');
		return {
			get visible() { return visible; },
			show() {
				gen++;
				el.classList.remove('kb-out', 'kb-in', 'kb-idle');
				void el.offsetWidth;
				el.classList.add('kb-in');
				el.style.visibility = 'visible';
				visible = true;
			},
			async hide() {
				if (!visible) return;
				visible = false;
				const g = ++gen;
				el.classList.add('kb-out');
				await KB.sleep(outMs);
				// Un show() (ou un autre hide()) arrivé entre-temps a la main : ne pas couper sa sortie
				if (g === gen) { el.classList.remove('kb-in', 'kb-out'); el.style.visibility = 'hidden'; el.classList.add('kb-idle'); }
			},
		};
	};

	/**
	 * Écran plein écran affiché/masqué via KB.presence. set(visible, render) : render() est appelé à chaque mise à jour,
	 * mais les entrées ne sont jouées qu'à l'apparition ; .kb-settled est posée une fois les entrées finies (settleMs).
	 * Ex. const scene = KB.scene(el, { settleMs: 3400 }); scene.set(cfg.visible, render);
	 */
	KB.scene = (el, { settleMs = 3400, outMs = 420 } = {}) => {
		const p = KB.presence(el, outMs);
		let settleT;
		return {
			get visible() { return p.visible; },
			set(visible, renderFn) {
				if (visible && !p.visible) {
					el.classList.remove('kb-settled');
					renderFn();
					p.show();
					clearTimeout(settleT);
					settleT = setTimeout(() => el.classList.add('kb-settled'), settleMs);
				} else if (visible) {
					renderFn();
				} else if (p.visible) {
					clearTimeout(settleT);
					el.classList.remove('kb-settled');
					p.hide();
				}
			},
		};
	};

	/** Rejoue une animation CSS portée par une classe (retire la classe, force un reflow, la remet). */
	KB.restart = (el, cls) => {
		if (!el) return;
		el.classList.remove(cls);
		void el.offsetWidth;
		el.classList.add(cls);
	};

	/**
	 * Compteur animé : anime le texte d'un élément de 0 vers sa valeur (« 230 », « 1,25 », « 57,3 % »…) en gardant
	 * le séparateur décimal et le suffixe ; à la fin, le texte est exactement `target`. Un texte non numérique est écrit tel quel.
	 */
	KB.countUp = (el, target, { delay = 300, duration = 1000 } = {}) => {
		const str = String(target ?? '');
		// Jeton : un nouvel appel sur le même élément arrête l'animation précédente
		const token = (el._kbCountUp = (el._kbCountUp || 0) + 1);
		const m = /^(-?)(\d+)(?:([.,])(\d+))?(\s*%?)$/.exec(str);
		if (!m) { el.textContent = str || '–'; return; }
		const [, sign, int, sep = '.', dec = '', suffix] = m;
		const n = parseFloat(int + '.' + (dec || '0'));
		const fmt = (v) => { const t = v.toFixed(dec.length); return (sign && +t ? sign : '') + t.replace('.', sep) + suffix; };
		const t0 = performance.now() + delay;
		el.textContent = fmt(0);
		const step = (t) => {
			if (el._kbCountUp !== token) return;
			const k = Math.min(1, Math.max(0, (t - t0) / duration));
			if (k >= 1) { el.textContent = str; return; }
			el.textContent = fmt(n * (1 - Math.pow(1 - k, 3)));
			requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	};

	/**
	 * Réduit la taille de police d'un élément jusqu'à ce que son texte tienne en largeur (et en hauteur si height).
	 *  max : taille de départ en px (sinon taille CSS) · min : plancher · step : pas en px · width : largeur imposée (sinon clientWidth)
	 *  wrap : si défini, force une seule ligne ; wrap = true autorise ensuite 2 lignes si le texte ne tient toujours pas.
	 * Ex. KB.fit(el, { max: 76, min: 50 }) → renvoie la taille retenue
	 */
	KB.fit = (el, { max, min = 12, step = 2, width, height = false, wrap } = {}) => {
		if (!el) return;
		const set = (s) => { el.style.fontSize = s + 'px'; };
		let size;
		if (max == null) { el.style.fontSize = ''; size = parseFloat(getComputedStyle(el).fontSize); } else { size = max; set(size); }
		if (wrap !== undefined) el.style.whiteSpace = 'nowrap';
		const tooWide = () => el.scrollWidth > (width || el.clientWidth) + 1;
		const tooHigh = () => el.scrollHeight > el.clientHeight + 1;
		let guard = 60;
		while (guard-- > 0 && size > min && (tooWide() || (height && tooHigh()))) set((size -= step));
		if (wrap && tooWide()) {
			el.style.whiteSpace = 'normal';
			// 2 lignes max (line-clamp côté CSS) : on réduit encore si le texte déborde en hauteur
			const floor = Math.round(min * 0.7);
			while (size > floor && el.scrollHeight > el.clientHeight + 2) set((size -= step));
		}
		return size;
	};

	/** Formate un compte à rebours mm:ss (ou h:mm:ss) */
	KB.formatCountdown = (ms) => {
		const s = Math.max(0, Math.ceil(ms / 1000));
		const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
		const pad = (x) => String(x).padStart(2, '0');
		return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
	};

	// Rechargement automatique des overlays quand leur code change (replicant kbBuild, extension/dev-reload.js).
	// Uniquement pour les graphics : les panneaux ne se rechargent pas (saisie en cours). Dans une iframe
	// (graphics/stream.html), c'est la page parente qui recharge tout : se recharger aussi ferait un double rechargement.
	if (/\/graphics\//.test(location.pathname) && !/[?&](export|preview)=/.test(location.search) && window.parent === window) {
		const build = nodecg.Replicant('kbBuild', { defaultValue: 0, persistent: false });
		let first = null;
		build.on('change', (v) => {
			if (first === null) { first = v; return; }
			if (v && v !== first) setTimeout(() => location.reload(), 300 + Math.random() * 700);
		});
	}

	// Diagnostic du direct (panneau Données, extension/diag.js) : chaque page d'overlay répond à une mesure (replicant diagPing)
	// avec le temps de réception, puis le temps jusqu'à la prochaine image affichée. Un navigateur qui suspend ses images
	// (source vMix / OBS jugée hors écran) se voit ainsi. Pas dans l'aperçu / l'export du stinger.
	if (/\/graphics\//.test(location.pathname) && !/[?&](export|preview)=/.test(location.search)) {
		const page = location.pathname.split('/').pop() || '?';
		// Un identifiant par navigateur : les iframes de stream.html reprennent celui de la page parente
		let client;
		try { client = (window.top.__kbDiagClient ||= Math.random().toString(36).slice(2, 8)); } catch { client = Math.random().toString(36).slice(2, 8); }
		const diag = nodecg.Replicant('diagPing', { defaultValue: { run: null, id: null, t: 0 }, persistent: false });
		let seen = null; // mesure déjà présente au chargement : ignorée
		diag.on('change', (v) => {
			if (seen === null) { seen = (v && v.id) || ''; return; }
			if (!v || !v.id || v.id === seen) return;
			seen = v.id;
			const sock = window.socket && window.socket.io && window.socket.io.engine;
			const base = { run: v.run, id: v.id, client, page, ua: navigator.userAgent, vis: document.visibilityState, transport: sock && sock.transport ? sock.transport.name : '', framed: window.parent !== window };
			const send = (extra) => nodecg.sendMessage('diag:pong', { ...base, ...extra }).catch(() => {});
			send({ stage: 'recv' });
			const t0 = performance.now();
			let raf = null, tmo = null, sent = false;
			const frame = () => { if (sent) return; sent = true; send({ stage: 'frame', raf, tmo }); };
			setTimeout(() => { tmo = Math.round(performance.now() - t0); }, 0);
			requestAnimationFrame(() => { raf = Math.round(performance.now() - t0); setTimeout(frame, 0); });
			setTimeout(frame, 3000);
		});
	}

	window.KB = KB;
})();
