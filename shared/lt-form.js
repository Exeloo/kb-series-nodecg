// Formulaire des lower thirds (gauche / centre / droite), le même pour les panneaux Régie et Live → window.KBLT
// <script src="../shared/lt-form.js"></script>  (après kb.js, live.js, dash.js et overlays.js)
//
//   KBLT.mount(container, { compact }) → { applyPreset(side, preset) }
//     compact : style + titre + sous-titre (Régie) ; sinon formulaire complet + presets en 1 clic + « Enregistrer comme preset » (panneau Lower thirds)
//   KBLT.mountCrew(container)
//   KBLT.mountMonitor(container)
//     « À l'antenne » : aperçu réel du graphique (graphics/lower-third.html réduit) + état de chaque emplacement
//     (en direct ou non, texte affiché, compte à rebours du masquage auto), Masquer / Réafficher
//     « Plateau » : choisir quel intervenant (host, casters) va à gauche, au centre et à droite, puis tout afficher en 1 clic
// Le formulaire suit l'antenne tant qu'il n'a ni focus ni modification locale (KBD.bindDirty) : deux panneaux ouverts
// en même temps ne renvoient jamais un vieux texte à l'antenne. Écrit liveLowerThird (contenu ; visibilité via KBO)
// et liveLowerThirdPresets (version complète).
(function () {
	const KBLT = {};
	const SIDES = LIVE.SIDES;
	const ovId = (side) => 'lower-third-' + side;
	const ltRep = () => nodecg.Replicant('liveLowerThird', { defaultValue: LIVE.defaults.liveLowerThird });

	// Écrit champ par champ : une visibilité changée au même moment par un autre panneau n'est pas écrasée
	function writeSlot(lt, side, obj) {
		const v = lt.value;
		if (v && v[side] && typeof v[side] === 'object') {
			for (const [k, x] of Object.entries(obj)) if (v[side][k] !== x) v[side][k] = x;
		} else {
			const n = LIVE.normalizeLowerThird(v);
			Object.assign(n[side], obj);
			lt.value = n;
		}
	}
	const styleOptions = () => Object.entries(LIVE.styles).map(([k, s]) => `<option value="${k}">${KB.esc(s.label)}</option>`).join('');

	// Version compacte : tout tient sur trois lignes
	const compactCard = (side, name, id) => `<div class="ltc" data-side="${side}">
		<div data-f="form">
			<div class="ltc-head"><span class="dot" data-f="dot"></span><b>${name.toUpperCase()}</b>
				<label class="vh" for="${id}-load">Charger un preset dans les champs</label><select id="${id}-load" data-f="load"></select>
				<label class="vh" for="${id}-style">Style</label><select id="${id}-style" class="ltc-style" data-f="style">${styleOptions()}</select></div>
			<div class="ltc-fields">
				<label class="vh" for="${id}-title">Titre</label><input id="${id}-title" data-f="title" placeholder="Titre">
				<label class="vh" for="${id}-subtitle">Sous-titre</label><input id="${id}-subtitle" data-f="subtitle" placeholder="Sous-titre">
			</div>
		</div>
		<div class="ltc-btns"><span class="ltc-state" data-f="state"></span>
			<button type="button" class="primary" data-a="update" title="Entrée dans un champ = Mettre à jour">Mettre à jour</button><button type="button" data-a="toggle"></button></div>
	</div>`;

	// Version complète (Live)
	const fullCard = (side, name, id) => `<div class="card" data-side="${side}">
		<div class="ovrow"><span class="dot" data-f="dot"></span><span class="name"><span class="side-title">${name}</span> <small data-f="state"></small></span><button type="button" data-a="toggle"></button></div>
		<div class="hint">Afficher un preset en 1 clic</div>
		<div class="presets" data-f="presets"></div>
		<div data-f="form">
			<label for="${id}-load">Charger un preset dans les champs (sans l'afficher)</label><select id="${id}-load" data-f="load"></select>
			<div class="grid2">
				<div><label for="${id}-style">Style</label><select id="${id}-style" data-f="style">${styleOptions()}</select></div>
				<div><label for="${id}-duration">Masquer après (s, 0 = manuel)</label><input id="${id}-duration" data-f="duration" type="number" min="0" step="1" value="0"></div>
			</div>
			<label for="${id}-kicker">Surtitre (vide = auto)</label><input id="${id}-kicker" data-f="kicker" placeholder="ex. CASTER, ANNONCE…">
			<label for="${id}-title">Titre</label><input id="${id}-title" data-f="title" placeholder="ex. Pause technique">
			<label for="${id}-subtitle">Sous-titre</label><input id="${id}-subtitle" data-f="subtitle" placeholder="ex. Reprise dans quelques instants">
		</div>
		<div class="hint" data-f="src"></div>
		<div class="row"><button type="button" class="primary" data-a="update" title="Entrée dans un champ = Mettre à jour">Mettre à jour (sans masquer)</button></div>
		<div class="row"><label class="vh" for="${id}-pname">Nom du preset</label><input id="${id}-pname" data-f="pname" placeholder="Nom du preset"><button type="button" class="shrink" data-a="save">Enregistrer comme preset</button></div>
		<div class="msg" data-f="msg"></div>
	</div>`;

	KBLT.mount = (container, { compact = false } = {}) => {
		const root = typeof container === 'string' ? document.querySelector(container) : container;
		const lt = ltRep();
		const ltp = nodecg.Replicant('liveLowerThirdPresets', { defaultValue: LIVE.defaults.liveLowerThirdPresets });
		const prefix = compact ? 'ltc' : 'ltf';
		root.innerHTML = Object.entries(SIDES).map(([side, name]) => (compact ? compactCard : fullCard)(side, name, `${prefix}-${side}`)).join('');

		const card = (side) => root.querySelector(`[data-side="${side}"]`);
		const field = (side, f) => card(side).querySelector(`[data-f="${f}"]`);
		const btn = (side, a) => card(side).querySelector(`[data-a="${a}"]`);
		const ltVal = () => LIVE.normalizeLowerThird(lt.value);
		const presets = () => (Array.isArray(ltp.value) ? ltp.value : []);
		const allPresets = () => [...LIVE.autoPresets(KB), ...presets()];
		const casterText = (i) => { const c = (KB.rep.casters.value || [])[i] || {}; return { title: c.name || LIVE.roleLabel(c), subtitle: c.handle || '' }; };

		// Champs visibles du formulaire ; les autres (surtitre et durée en version compacte, source caster) sont repris
		// de la dernière valeur chargée : un preset caster reste lié au caster tant qu'on ne retouche pas le titre / sous-titre
		const FIELDS = compact ? ['style', 'title', 'subtitle'] : ['style', 'kicker', 'title', 'subtitle', 'duration'];
		const keep = Object.fromEntries(LIVE.SIDE_KEYS.map((k) => [k, {}]));
		function read(side) {
			const o = { ...keep[side] };
			for (const f of FIELDS) {
				const v = field(side, f).value;
				o[f] = f === 'duration' ? Math.max(0, +v || 0) : f === 'style' ? v : v.trim();
			}
			return o;
		}
		function fill(side, s) {
			const c = s.source === 'caster' ? { ...s, ...casterText(+s.casterIndex || 0) } : s;
			keep[side] = { kicker: s.kicker || '', duration: +s.duration || 0, source: s.source === 'caster' ? 'caster' : 'custom', casterIndex: +s.casterIndex || 0 };
			for (const f of FIELDS) field(side, f).value = f === 'duration' ? +c.duration || 0 : f === 'style' ? c.style || 'standard' : c[f] || '';
		}
		// Ce qui se voit à l'écran (texte du caster résolu) : sert à comparer le formulaire et l'antenne
		const view = (s) => {
			const t = s.source === 'caster' ? casterText(+s.casterIndex || 0) : s;
			return JSON.stringify([s.style || 'standard', s.kicker || '', (t.title || '').trim(), (t.subtitle || '').trim(), +s.duration || 0]);
		};
		const content = (obj) => { const o = {}; for (const k of LIVE.presetFields) o[k] = obj[k]; return o; };

		const write = (side, obj) => writeSlot(lt, side, obj);
		const apply = (side) => write(side, content(read(side)));
		const show = (side) => { apply(side); KBO.show(ovId(side)); };
		const applyPreset = (side, p) => {
			fill(side, p);
			write(side, LIVE.presetContent(p));
			KBO.show(ovId(side));
			forms[side].sync();
		};

		function state(side, dirty) {
			const on = KBO.isVisible(ovId(side));
			field(side, 'dot').classList.toggle('on', on);
			const st = field(side, 'state');
			st.textContent = dirty ? 'Modifications non appliquées' : on ? 'À l\'antenne' : 'Masqué';
			st.classList.toggle('lt-dirty', dirty);
			btn(side, 'update').disabled = !dirty;
			const t = btn(side, 'toggle');
			t.textContent = on ? '● À L\'ANTENNE' : 'AFFICHER';
			t.classList.toggle('onair', on);
			t.title = on ? 'Cliquer pour masquer' : 'Applique les champs et affiche';
		}

		const forms = {};
		for (const side of Object.keys(SIDES)) {
			forms[side] = KBD.bindDirty(field(side, 'form'), {
				read: () => read(side),
				fill: (v) => fill(side, v),
				live: () => (lt.value ? ltVal()[side] : undefined),
				same: (a, b) => view(a) === view(b),
				onState: (dirty) => state(side, dirty),
			});
			btn(side, 'toggle').addEventListener('click', () => (KBO.isVisible(ovId(side)) ? KBO.hide(ovId(side)) : show(side)));
			btn(side, 'update').addEventListener('click', () => apply(side));
			for (const f of FIELDS) {
				const el = field(side, f);
				if (f === 'title' || f === 'subtitle') el.addEventListener('input', () => { keep[side] = { ...keep[side], source: 'custom', casterIndex: 0 }; });
				if (el.tagName === 'INPUT') el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(side); } });
			}
			const load = field(side, 'load');
			load.addEventListener('change', () => {
				const p = allPresets().find((x) => x.id === load.value);
				load.value = '';
				if (p) { fill(side, p); forms[side].sync(); }
			});
			// Menu non réécrit tant qu'il a le focus (KBD.fillSelect) : rattrapage à la sortie
			load.addEventListener('blur', () => render());
			if (compact) continue;
			field(side, 'presets').addEventListener('click', (e) => {
				const b = e.target.closest('button[data-pid]');
				const p = b && allPresets().find((x) => x.id === b.dataset.pid);
				if (p) applyPreset(side, p);
			});
			btn(side, 'save').addEventListener('click', () => {
				const name = field(side, 'pname').value.trim() || field(side, 'title').value.trim();
				if (!name) return KBD.flash(field(side, 'msg'), 'Donne un nom au preset', 'err', 3500);
				const list = presets().map((p) => ({ ...p }));
				const ex = list.find((p) => p.name.toLowerCase() === name.toLowerCase());
				if (ex) Object.assign(ex, content(read(side))); else list.push({ id: LIVE.newId(), name, ...content(read(side)) });
				ltp.value = list;
				field(side, 'pname').value = '';
				KBD.flash(field(side, 'msg'), ex ? `Preset « ${name} » mis à jour` : `Preset « ${name} » enregistré`, 'ok', 3500);
			});
		}

		function render() {
			const auto = LIVE.autoPresets(KB), mine = presets();
			const opt = (p) => `<option value="${KB.esc(p.id)}">${KB.esc(p.name)}</option>`;
			const loadHtml = `<option value="">${compact ? 'Preset…' : '— choisir —'}</option><optgroup label="Automatiques">${auto.map(opt).join('')}</optgroup>`
				+ (mine.length ? `<optgroup label="Mes presets">${mine.map(opt).join('')}</optgroup>` : '');
			const live = ltVal();
			for (const side of Object.keys(SIDES)) {
				KBD.fillSelect(field(side, 'load'), loadHtml, '');
				if (!compact) {
					const box = field(side, 'presets');
					const html = [...auto, ...mine].map((p) => `<button type="button"${p.auto ? '' : ' class="gold"'} data-pid="${KB.esc(p.id)}" title="${KB.esc([p.title, p.subtitle].filter(Boolean).join(' — '))}">${KB.esc(p.name)}</button>`).join('');
					if (box._html !== html) { box.innerHTML = html; box._html = html; }
					const s = live[side];
					const c = s.source === 'caster' ? (KB.rep.casters.value || [])[s.casterIndex] : null;
					field(side, 'src').textContent = s.source === 'caster' ? `À l'antenne : ${c ? LIVE.roleLabel(c).toLowerCase() : 'intervenant'} « ${c ? c.name : '?'} » (suit l'éditeur des intervenants)` : '';
				}
				forms[side].sync();
			}
		}
		KB.watch(['casters', 'schedule', 'match', 'teams', lt, ltp], render);

		return { applyPreset };
	};

	// ---------- Plateau : qui est à gauche / au centre / à droite ----------
	// Tant que le régisseur n'a rien choisi, les menus montrent ce qui est à l'antenne (emplacements affichés qui suivent
	// un intervenant), sinon une répartition par défaut : premier host au centre, deux premiers casters à gauche et à droite.
	// Recalculée quand les intervenants changent ; dès qu'un menu est touché, c'est le choix du régisseur qui reste.
	KBLT.mountCrew = (container) => {
		const root = typeof container === 'string' ? document.querySelector(container) : container;
		const lt = ltRep();
		const uid = 'crew' + Math.random().toString(36).slice(2, 7);
		root.innerHTML = `<div class="crew">
			<div class="crew-grid">${Object.entries(SIDES).map(([side, name]) => `<div><label for="${uid}-${side}">${name}</label><select id="${uid}-${side}" data-side="${side}"></select></div>`).join('')}</div>
			<div class="row"><button type="button" class="primary" data-a="show">AFFICHER LE PLATEAU</button><button type="button" class="shrink" data-a="hide">Masquer</button></div>
			<div class="hint" data-f="hint"></div>
		</div>`;
		const sel = (side) => root.querySelector(`select[data-side="${side}"]`);
		const people = () => KB.rep.casters.value || [];
		let choice = null; // { left, center, right } : index dans casters ou '' (personne)
		let touched = false;

		function initialChoice() {
			const v = LIVE.normalizeLowerThird(lt.value), list = people();
			const fromAir = Object.fromEntries(LIVE.SIDE_KEYS.map((k) => [k, v[k].visible && v[k].source === 'caster' && list[v[k].casterIndex] ? String(v[k].casterIndex) : '']));
			if (LIVE.SIDE_KEYS.some((k) => fromAir[k] !== '')) return fromAir;
			const hosts = [], casters = [];
			list.forEach((c, i) => (LIVE.roleOf(c) === 'host' ? hosts : casters).push(String(i)));
			return { left: casters[0] || '', center: hosts[0] || '', right: casters[1] || '' };
		}
		function render() {
			const list = people();
			if (!choice || !touched) choice = initialChoice();
			const opts = '<option value="">— personne —</option>' + list.map((c, i) => `<option value="${i}">${KB.esc(LIVE.roleLabel(c))} · ${KB.esc(c.name || '(sans nom)')}</option>`).join('');
			for (const side of LIVE.SIDE_KEYS) {
				if (choice[side] !== '' && !list[+choice[side]]) choice[side] = '';
				KBD.fillSelect(sel(side), opts, choice[side]);
			}
			const on = LIVE.SIDE_KEYS.filter((k) => KBO.isVisible(ovId(k)));
			root.querySelector('[data-f="hint"]').textContent = list.length
				? (on.length ? `À l'antenne : ${on.map((k) => SIDES[k].toLowerCase()).join(', ')}. ` : '') + 'Un emplacement sur « personne » est masqué.'
				: 'Aucun intervenant : ajoute le host et les casters dans le panneau Lower thirds.';
		}
		for (const side of LIVE.SIDE_KEYS) sel(side).addEventListener('change', (e) => { choice[side] = e.target.value; touched = true; });
		root.querySelector('[data-a="show"]').addEventListener('click', () => {
			for (const side of LIVE.SIDE_KEYS) {
				const v = sel(side).value;
				choice[side] = v;
				touched = true;
				if (v === '') { KBO.hide(ovId(side)); continue; }
				writeSlot(lt, side, { style: 'standard', kicker: '', title: '', subtitle: '', source: 'caster', casterIndex: +v, duration: 0 });
				KBO.show(ovId(side));
			}
		});
		root.querySelector('[data-a="hide"]').addEventListener('click', () => LIVE.SIDE_KEYS.forEach((k) => KBO.hide(ovId(k))));
		KB.watch(['casters', lt, ...KBO.reps()], render);
	};

	// ---------- Moniteur « À l'antenne » ----------
	// Bande du bas de l'écran 1920×1080 montrée dans l'aperçu (les lower thirds sont à 136 px du bas ; le ticker n'y est pas)
	const BAND_TOP = 770, BAND_H = 200;
	KBLT.mountMonitor = (container) => {
		const root = typeof container === 'string' ? document.querySelector(container) : container;
		const lt = ltRep();
		root.innerHTML = `<div class="ltm">
			<div class="ltm-screen" aria-hidden="true"><iframe src="../graphics/lower-third.html" tabindex="-1" title="Aperçu des lower thirds"></iframe><span class="ltm-tag">Aperçu de l'antenne</span></div>
			<div class="ltm-slots">${Object.entries(SIDES).map(([side, name]) => `<div class="ltm-slot" data-side="${side}">
				<div class="ltm-head"><b>${name}</b><span class="ltm-badge" data-f="badge"></span></div>
				<div class="ltm-text" data-f="text"></div>
				<div class="ltm-foot"><span data-f="timer"></span><button type="button" data-f="btn"></button></div>
			</div>`).join('')}</div>
			<div class="row"><button type="button" class="danger" data-f="hideAll" title="Masque les lower thirds gauche, centre et droite (le ticker et les autres overlays restent à l'antenne)">Masquer les 3 lower thirds</button></div>
		</div>`;
		const screen = root.querySelector('.ltm-screen'), frame = screen.querySelector('iframe');
		// L'aperçu garde les proportions de l'antenne : 1920 px de large ramenés à la largeur du panneau
		const fit = () => {
			const k = screen.clientWidth / 1920;
			screen.style.height = Math.round(BAND_H * k) + 'px';
			frame.style.transform = `translateY(${-BAND_TOP * k}px) scale(${k})`;
		};
		new ResizeObserver(fit).observe(screen);
		fit();

		const slot = (side) => root.querySelector(`.ltm-slot[data-side="${side}"]`);
		const f = (side, name) => slot(side).querySelector(`[data-f="${name}"]`);
		const val = () => LIVE.normalizeLowerThird(lt.value);
		function tick() {
			const v = val();
			for (const side of LIVE.SIDE_KEYS) {
				const s = v[side], on = KBO.isVisible(ovId(side)), left = Math.ceil(((+s.hideAt || 0) - Date.now()) / 1000);
				f(side, 'timer').textContent = !on ? '' : left > 0 ? `masqué auto dans ${left} s` : +s.duration > 0 ? 'masquage auto…' : 'reste affiché';
			}
		}
		function render() {
			const v = val(), casters = KB.rep.casters.value;
			for (const side of LIVE.SIDE_KEYS) {
				const s = v[side], on = KBO.isVisible(ovId(side)), c = LIVE.displayContent(s, casters);
				const el = slot(side);
				el.classList.toggle('on', on);
				el.dataset.style = c.style;
				f(side, 'badge').textContent = on ? '● EN DIRECT' : 'Masqué';
				f(side, 'text').innerHTML = c.title || c.subtitle
					? `<small>${KB.esc(c.kicker)}</small><b>${KB.esc(c.title || '—')}</b><span>${KB.esc(c.subtitle)}</span>`
					: '<span class="empty">Vide</span>';
				const b = f(side, 'btn');
				b.textContent = on ? 'Masquer' : 'Réafficher';
				b.className = on ? 'danger' : '';
				b.disabled = !on && !(c.title || c.subtitle);
				b.title = on ? 'Retire ce lower third de l\'antenne' : 'Remet ce texte à l\'antenne tel quel';
			}
			const any = LIVE.SIDE_KEYS.some((k) => KBO.isVisible(ovId(k)));
			root.querySelector('[data-f="hideAll"]').disabled = !any;
			tick();
		}
		root.addEventListener('click', (e) => {
			const b = e.target.closest('button[data-f]');
			if (!b) return;
			if (b.dataset.f === 'hideAll') return LIVE.SIDE_KEYS.forEach((k) => KBO.hide(ovId(k)));
			const side = b.closest('.ltm-slot').dataset.side;
			if (KBO.isVisible(ovId(side))) KBO.hide(ovId(side)); else KBO.show(ovId(side));
		});
		setInterval(tick, 500);
		KB.watch([lt, 'casters', ...KBO.repNames()], render);
	};

	window.KBLT = KBLT;
})();
