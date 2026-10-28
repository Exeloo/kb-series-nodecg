// Partie "planning" — rendu du planning de la journée, commun à graphics/planning.html (overlay plein écran, mode 'overlay')
// et graphics/schedule.html (scène de fond « Planning » de stream.html, mode 'scene'). Navigateur seulement → window.KBPV
// <script src="../shared/kb.js"></script> <script src="../shared/scenes.js"></script> <script src="../shared/bracket.js"></script>
// <script src="../shared/planning.js"></script> <script src="../shared/planning-view.js"></script>, et ../shared/planning.css.
//   KBPV.mount({ mode })  construit la page dans <body> et la tient à jour
// Replicants lus : planning, bracket (phase finale, noms des groupes), teams, tournament, scenesTexts (titre et sur-titre du planning),
// et en mode 'overlay' planningGraphic (visibilité, défaut KBPlan.GRAPHIC_DEFAULT).
(function () {
	const V = {};
	const esc = KB.esc;
	const S = window.KBScenes;
	const FORMAT = { bo1: 'BO1', bo3: 'BO3', bo5: 'BO5' };

	const PAGE = `
		<div id="pl-root">
			<div class="kb-bg fade"><div class="kb-bg__art"></div><div class="kb-bg__grid"></div><div class="kb-bg__stars"></div></div>
			<div class="kb-frame fade" style="--d:.1s"></div>
			<div id="pl-head">
				<div class="logoWrap kb-anim kb-anim--pop" style="--d:.1s;--i:0"><img class="kb-logo" src="../shared/img/kbs-logo.png" alt=""></div>
				<div class="txt">
					<div class="kb-kicker kb-anim kb-anim--left" style="--d:.1s;--i:1" id="pl-kicker"></div>
					<div class="kb-title kb-anim kb-anim--left" style="--d:.1s;--i:2" id="pl-title"></div>
				</div>
				<div class="right">
					<div class="date kb-anim kb-anim--right" style="--d:.1s;--i:2" id="pl-date"></div>
					<span class="kb-pill kb-anim kb-anim--right" style="--d:.1s;--i:3" id="pl-place"></span>
				</div>
			</div>
			<div id="pl-rule" class="kb-rule kb-rule--gold"></div>
			<div id="pl-board"></div>
			<div id="pl-empty" class="fade" style="--d:.6s;display:none">Planning à venir</div>
			<div id="pl-foot" class="fade" style="--d:1.6s">
				<div class="legend"><span><em class="badge stream"><i></i>Sur le stream</em></span><span><em class="badge off"><i></i>Hors stream</em></span></div>
				<div class="partners"><span>Présenté par</span><img src="../shared/img/cycom-alpha.png" alt=""><span class="sep"></span><img src="../shared/img/epitech-alpha.png" alt=""></div>
			</div>
		</div>`;

	const teamName = (id) => { const t = KB.team(id); return t ? t.name : ''; };

	/** Pastille de la carte : en direct sur le stream, diffusé, hors stream, terminé */
	function badge(v) {
		if (v.status === 'live' && v.streamed) return '<span class="badge onair"><i></i>En direct</span>';
		if (v.status === 'done') return '<span class="badge done">Terminé</span>';
		if (v.status === 'live') return '<span class="badge off"><i></i>En cours · hors stream</span>';
		return v.streamed ? '<span class="badge stream"><i></i>Sur le stream</span>' : '<span class="badge off"><i></i>Hors stream</span>';
	}

	// Pause : tasse + nom + durée, sur toute la largeur du créneau
	const CUP = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18h26v10a12 12 0 0 1-12 12h-2A12 12 0 0 1 8 28z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/>'
		+ '<path d="M34 21h3a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="3.5"/><path class="steam" d="M16 13c0-3 3-3 3-6M23 13c0-3 3-3 3-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
	const breakInner = (v) => `<div class="bk"><span class="cup">${CUP}</span><span class="bn">${esc(v.title)}</span><span class="dur">${v.minutes} min</span></div><div class="shine"></div><div class="flash"></div>`;

	function cardInner(v, L) {
		if (KBPlan.isBreak(v)) return breakInner(v);
		const logo = Math.round(L.sh * (L.tight ? .58 : .42));
		const side = (key) => {
			const id = key === 'A' ? v.teamA : v.teamB;
			const t = KB.team(id);
			const lose = v.winner && v.winner !== key, win = v.winner === key;
			// data-full / data-tag : nom complet, et tag de repli si le nom ne tient pas (fitCard)
			const nm = t ? `<span class="nm" data-full="${esc(t.name)}" data-tag="${esc(t.tag || '')}">${esc(t.name)}</span>` : `<span class="nm tbd">${esc(id ? String(id).toUpperCase() : KBPlan.placeholder(v, key))}</span>`;
			return `<div class="tm ${key === 'A' ? 'a' : 'b'}${lose ? ' lose' : ''}${win ? ' win' : ''}"><span class="lg">${t ? KB.teamLogo(t, logo) : ''}</span>${nm}</div>`;
		};
		const played = v.status !== 'upcoming' && v.scoreA !== null && v.scoreB !== null;
		const a = +v.scoreA || 0, b = +v.scoreB || 0;
		const mid = played
			? `<span class="${v.winner === 'A' ? 'w' : v.winner === 'B' ? 'l' : ''}" data-s="a">${a}</span><span class="d">–</span><span class="${v.winner === 'B' ? 'w' : v.winner === 'A' ? 'l' : ''}" data-s="b">${b}</span>`
			: '<span class="x">VS</span>';
		return `<div class="top"><span class="ph" data-full="${esc(v.title)}" data-short="${esc(v.short || v.title)}">${esc(v.title)}</span><span class="fmt">${FORMAT[v.format] || ''}</span>${badge(v)}</div>
			<div class="vs">${side('A')}<span class="sc">${mid}</span>${side('B')}</div>
			<div class="shine"></div><div class="flash"></div>`;
	}
	/** Textes d'une carte ajustés à sa largeur : libellé court si le complet déborde, noms réduits puis remplacés par le tag */
	// Débordement strict : un dépassement d'une fraction de pixel suffit à afficher « … »
	const over = (n) => n.scrollWidth > n.clientWidth;
	const shrink = (n, min) => { let s = parseFloat(getComputedStyle(n).fontSize); while (s > min && over(n)) n.style.fontSize = (s -= 1) + 'px'; };
	function fitCard(el) {
		const ph = KB.$('.ph', el);
		if (ph) { ph.textContent = ph.dataset.full; if (over(ph)) ph.textContent = ph.dataset.short; }
		// Taille d'origine (CSS), puis réduite jusqu'à 55 % ; au-delà, le tag de l'équipe remplace son nom
		const names = KB.$$('.nm, .bn', el);
		for (const n of names) {
			n.style.fontSize = '';
			if (n.dataset.full) n.textContent = n.dataset.full;
			const base = parseFloat(getComputedStyle(n).fontSize);
			shrink(n, Math.max(14, Math.round(base * .55)));
			if (n.dataset.tag && over(n)) { n.textContent = n.dataset.tag; n.style.fontSize = ''; shrink(n, 14); }
		}
		// Les deux équipes d'une carte à la même taille (la plus petite des deux)
		const teams = names.filter((n) => n.classList.contains('nm') && !n.classList.contains('tbd'));
		if (teams.length === 2) { const s = Math.min(...teams.map((n) => parseFloat(getComputedStyle(n).fontSize))); teams.forEach((n) => { n.style.fontSize = s + 'px'; }); }
	}
	const cardClass = (v) => (KBPlan.isBreak(v) ? 'card brk upcoming' : `card ${v.status} ${v.streamed ? 'streamed' : 'offstream'}`);
	const sigOf = (v) => JSON.stringify([v.title, v.minutes, v.time, v.end, v.format, v.teamA, v.teamB, teamName(v.teamA), teamName(v.teamB), v.scoreA, v.scoreB, v.status, v.winner, v.streamed,
		(KB.team(v.teamA) || {}).logo, (KB.team(v.teamB) || {}).logo]);

	V.mount = ({ mode = 'overlay' } = {}) => {
		document.body.insertAdjacentHTML('afterbegin', PAGE);
		const root = KB.$('#pl-root'), board = KB.$('#pl-board');
		const planRep = nodecg.Replicant('planning', { defaultValue: KB.clone(KBPlan.DEFAULT) });
		const bracketRep = nodecg.Replicant('bracket', { defaultValue: KBB.defaultBracket() });
		const gfxRep = mode === 'overlay' ? nodecg.Replicant('planningGraphic', { defaultValue: KB.clone(KBPlan.GRAPHIC_DEFAULT) }) : null;
		let layoutKey = '', L = {};

		// Hauteur des créneaux selon leur nombre (zone utile : 1080 - 222 - 112)
		function layout(slots) {
			const n = Math.max(1, slots.length);
			const gap = n > 10 ? 5 : n > 7 ? 8 : 12;
			// Jusqu'à 16 créneaux tiennent dans la zone (40 px minimum par créneau)
			const sh = Math.max(40, Math.min(130, Math.floor((746 - gap * (n - 1)) / n)));
			// compact : deux lignes serrées ; tight (créneaux très fins) : libellé et équipes sur une seule ligne
			const compact = sh < 84, tight = sh < 62;
			L = { sh, gap, compact, tight };
			board.style.setProperty('--sh', sh + 'px');
			board.style.setProperty('--gap', gap + 'px');
			const used = n * sh + (n - 1) * gap;
			const top = Math.max(0, (746 - used) / 2);
			board.style.setProperty('--rail-top', top + sh / 2 + 'px');
			board.style.setProperty('--rail-bottom', top + sh / 2 + 'px');
			// La lumière (110 px) part au-dessus du 1er nœud et s'arrête sur le dernier, sans déborder sur le pied de page
			board.style.setProperty('--rail-run', Math.max(0, used - sh - 110) + 'px');
		}

		// Une carte qui change de largeur (rendue masquée, polices chargées, nouvelle mise en page) réajuste ses textes
		const resized = new ResizeObserver((entries) => { for (const e of entries) if (e.contentRect.width > 0) fitCard(e.target); });
		function build(slots, animate) {
			resized.disconnect();
			layout(slots);
			board.innerHTML = slots.map((s, si) => `
				<div class="slot${L.compact ? ' compact' : ''}${L.tight ? ' tight' : ''}${s.matches.length >= 3 ? ' n3' : ''}" data-slot="${s.slot}" style="--nfs:${Math.round(L.sh * (L.tight ? .36 : .3))}px">
					<div class="when kb-anim kb-anim--left" style="--d:.5s;--i:${si}"><b>${s.time}</b><small>→ ${s.end}</small></div>
					<span class="node kb-anim kb-anim--pop" style="--d:.6s;--i:${si}"></span>
					<div class="cards">${s.matches.map((v, ci) => `<div class="${cardClass(v)} kb-anim kb-anim--left${animate ? ' appear' : ''}" data-id="${esc(v.id)}" style="--d:.6s;--i:${(si + ci * .5).toFixed(1)}"></div>`).join('')}</div>
				</div>`).join('');
		}

		function render() {
			const settled = root.classList.contains('kb-settled');
			const tx = S.texts().schedule, t = S.tournament();
			KB.$('#pl-kicker').textContent = [tx.kicker, t.name && t.edition ? `${t.name} · ${t.edition}` : t.name].filter(Boolean).join('  ·  ');
			KB.$('#pl-title').textContent = tx.title || S.DEFAULT_TEXTS.schedule.title;
			KB.$('#pl-date').textContent = t.dates || '';
			KB.$('#pl-place').textContent = t.location || '';
			const bk = bracketRep.value || KBB.defaultBracket();
			const slots = KBPlan.slots(planRep.value, bk);
			const key = JSON.stringify([L.sh, slots.map((s) => [s.slot, s.matches.map((v) => v.id)])]);
			if (key !== layoutKey) { layoutKey = key; build(slots, settled); KB.$$('.card', board).forEach((c) => resized.observe(c)); }
			// Contenu des cartes : réécrit seulement s'il change ; après l'entrée, un changement est signalé (reflet doré, score qui saute)
			for (const s of slots) {
				const slotEl = KB.$(`.slot[data-slot="${s.slot}"]`, board);
				if (!slotEl) continue;
				const games = s.matches.filter((v) => !KBPlan.isBreak(v));
				const st = games.some((v) => v.status === 'live') ? 'live' : games.length && games.every((v) => v.status === 'done') ? 'done' : '';
				slotEl.classList.toggle('break', !games.length);
				KB.$('.when b', slotEl).textContent = s.time;
				KB.$('.when small', slotEl).textContent = '→ ' + s.end;
				slotEl.classList.toggle('live', st === 'live');
				slotEl.classList.toggle('done', st === 'done');
				for (const v of s.matches) {
					const el = KB.$(`.card[data-id="${CSS.escape(v.id)}"]`, slotEl);
					if (!el) continue;
					const sig = sigOf(v);
					if (el.dataset.sig === sig) continue;
					const before = el.dataset.sig;
					el.dataset.sig = sig;
					el.className = el.className.replace(/\b(upcoming|live|done|streamed|offstream)\b/g, '').trim() + ' ' + cardClass(v).slice(5);
					el.innerHTML = cardInner(v, L);
					fitCard(el);
					if (before && settled) { KB.restart(KB.$('.flash', el), 'go'); KB.restart(KB.$('.sc', el), 'pop'); }
				}
			}
			KB.$('#pl-empty').style.display = slots.length ? 'none' : 'block';
		}

		const reps = ['tournament', 'teams', S.rep, planRep, bracketRep];
		if (mode === 'overlay') {
			const scene = KB.scene(root, { settleMs: 3000, outMs: 450 });
			KB.watch([...reps, gfxRep], () => scene.set(!!(gfxRep.value && gfxRep.value.visible), render));
		} else {
			// Scène de fond : toujours affichée (stream.html la montre ou la cache), entrée jouée une fois les polices chargées
			root.style.visibility = 'visible';
			KB.watch(reps, render);
			Promise.race([document.fonts.ready, KB.sleep(1500)]).then(() => {
				root.classList.add('kb-in');
				setTimeout(() => root.classList.add('kb-settled'), 3000);
			});
		}
		document.fonts.ready.then(() => KB.$$('#pl-board .card').forEach(fitCard));
	};

	window.KBPV = V;
})();
