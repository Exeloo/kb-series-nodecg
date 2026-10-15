// Outils communs des panneaux de régie → window.KBD
// <script src="../shared/dash.js"></script>  (après kb.js)
//
//   KBD.flash(el, text, kind?, ms?)            message temporaire dans un .msg (kind : 'ok' | 'err' | 'info' | '' ; ms = 0 → reste affiché)
//   KBD.confirm(btn, action, { label, ms })     bouton à confirmer en 2 clics (le 1er l'« arme », le 2e exécute)
//   KBD.arm(btn, action, { label, ms })         même chose pour un clic reçu par délégation (listes re-rendues)
//   KBD.disarm(btn)                             remet un bouton armé dans son état initial (à faire quand sa cible change)
//   KBD.deferWhileEditing(container, render, { busy, fields }) → safeRender : rendu différé tant qu'on saisit
//                                               ou qu'un bouton est enfoncé dans container (sinon le clic serait perdu)
//   KBD.fillSelect(sel, html, value?)           réécrit les <option> seulement si elles changent ; jamais pendant que le menu
//                                               a le focus (la mise à jour est alors appliquée quand il le perd)
//   KBD.teamOptions(selectedId, { empty, teams, label })  <option> des équipes (triées par nom)
//   KBD.getPath(obj, 'a.b.c') / KBD.setPath(obj, 'a.b.c', value)
//   KBD.bindDirty(container, { read, fill, live, same, onState }) → { sync, isDirty }  brouillon local d'un formulaire
//   KBD.copy(text) → Promise<bool>             copie dans le presse-papiers, y compris en http:// sur le réseau (repli sans API Clipboard)
(function () {
	const KBD = {};
	const byId = (el) => (typeof el === 'string' ? document.getElementById(el.replace(/^#/, '')) || document.querySelector(el) : el);
	const isField = (el) => !!(el && el.matches && el.matches('input, select, textarea'));

	/**
	 * Affiche `text` dans l'élément .msg `el` (élément ou id) puis l'efface après `ms` millisecondes.
	 * Les autres classes de l'élément (ex. .box) sont conservées. Un texte vide efface tout de suite.
	 */
	KBD.flash = (el, text, kind = 'ok', ms = 2500) => {
		const m = byId(el);
		if (!m) return null;
		clearTimeout(m._kbdFlash);
		const clear = () => { m.textContent = ''; m.classList.remove('ok', 'err', 'info'); };
		clear();
		m.classList.add('msg');
		if (!text) return m;
		m.textContent = text;
		if (kind) m.classList.add(kind);
		if (ms > 0) m._kbdFlash = setTimeout(clear, ms);
		return m;
	};

	// ---------- Confirmation en 2 clics ----------
	const armedState = new WeakMap(); // bouton → { html, timer }
	const disarm = (btn) => {
		const s = armedState.get(btn);
		if (!s) return;
		clearTimeout(s.timer);
		armedState.delete(btn);
		btn.classList.remove('armed');
		btn.innerHTML = s.html;
	};

	/**
	 * Premier appel : le bouton passe en rouge avec `label` pendant `ms` ; deuxième appel dans ce délai : exécute `action`.
	 * Renvoie true si l'action a été exécutée. À appeler depuis un gestionnaire de clic (délégation possible).
	 */
	KBD.arm = (btn, action, { label = 'Confirmer ?', ms = 4000 } = {}) => {
		if (armedState.has(btn)) { disarm(btn); action(); return true; }
		armedState.set(btn, { html: btn.innerHTML, timer: setTimeout(() => disarm(btn), ms) });
		btn.classList.add('armed');
		btn.textContent = label;
		return false;
	};

	/** Branche la confirmation en 2 clics sur un bouton (remplace son onclick : peut être rappelé à chaque rendu sans cumuler). */
	KBD.confirm = (btn, action, opts = {}) => {
		const b = byId(btn);
		if (b) b.onclick = (e) => KBD.arm(b, () => action(e), opts);
		return b;
	};

	/**
	 * Remet le bouton dans son état initial s'il est armé, sans rien exécuter. À appeler quand la cible du bouton change
	 * (autre joueur, autre map…) : sinon un seul clic suffirait à agir sur la nouvelle cible.
	 */
	KBD.disarm = (btn) => { const b = byId(btn); if (b) disarm(b); };

	// ---------- Rendu sans écraser une saisie ni un clic ----------
	const focusables = (box) => [...box.querySelectorAll('button, a[href], [tabindex]')];
	/**
	 * Renvoie safeRender() : appelle render() sauf si un champ (input/select/textarea) de `container` a le focus,
	 * si un bouton du conteneur est enfoncé (souris, doigt, Espace) ou si busy() renvoie vrai. Le rendu est alors rejoué
	 * à la sortie du champ ou juste après le clic : reconstruire le bouton entre l'appui et le relâchement ferait perdre
	 * le clic sans aucun message (cas typique : on tape un score puis on clique aussitôt un bouton de la même liste).
	 *  - fields: false → seuls l'appui et busy() retiennent le rendu (formulaire qui protège déjà ses champs un par un)
	 */
	KBD.deferWhileEditing = (container, render, { busy = null, fields = true } = {}) => {
		const box = byId(container);
		let pending = false;
		let pressed = false;
		let releaseT = 0;
		const safeRender = (...args) => {
			const a = document.activeElement;
			if (pressed || (busy && busy()) || (fields && box.contains(a) && isField(a))) { pending = true; return false; }
			pending = false;
			// Bouton focalisé (clavier) reconstruit par le rendu : le focus revient au bouton de même rang, sinon Entrée ne ferait plus rien
			const rank = a && a !== box && box.contains(a) ? focusables(box).indexOf(a) : -1;
			render(...args);
			if (rank >= 0 && !box.contains(document.activeElement)) { const el = focusables(box)[rank]; if (el) el.focus({ preventScroll: true }); }
			return true;
		};
		const replay = () => { if (pending) safeRender(); };
		const press = () => { clearTimeout(releaseT); pressed = true; };
		// Un appui dans un champ ne compte pas : c'est son focus qui le protège
		box.addEventListener('pointerdown', (e) => { if (!isField(e.target)) press(); }, true);
		// Espace sur un bouton : le clic part au relâchement de la touche (Entrée clique tout de suite)
		box.addEventListener('keydown', (e) => { if (e.key === ' ' && e.target.tagName === 'BUTTON') press(); }, true);
		// Le clic a déjà sa cible : on lâche avant ses gestionnaires (leurs propres rendus passent), le rendu en attente juste après
		window.addEventListener('click', () => { if (!pressed) return; clearTimeout(releaseT); pressed = false; setTimeout(replay, 0); }, true);
		// Relâché sans clic (hors du bouton, début de glisser-déposer, fenêtre quittée) : rendu après un court délai
		const release = () => {
			if (!pressed) return;
			clearTimeout(releaseT);
			releaseT = setTimeout(() => { pressed = false; replay(); }, 250);
		};
		for (const type of ['pointerup', 'pointercancel', 'keyup', 'dragend']) window.addEventListener(type, release, true);
		window.addEventListener('blur', (e) => { if (e.target === window) release(); });
		// setTimeout : au moment du focusout, le nouvel élément focalisé n'est pas encore connu
		box.addEventListener('focusout', () => setTimeout(replay, 0));
		return safeRender;
	};

	// ---------- Menus déroulants ----------
	const selectHtml = new WeakMap();
	const selectPending = new WeakMap(); // menu → { html, value, shown } : dernière mise à jour demandée pendant qu'il avait le focus
	const applySelect = (s, html, value) => {
		selectPending.delete(s);
		const prev = s.value;
		if (selectHtml.get(s) !== html) { s.innerHTML = html; selectHtml.set(s, html); }
		if (value !== undefined) s.value = value == null ? '' : String(value);
		else if ([...s.options].some((o) => o.value === prev)) s.value = prev;
	};
	/**
	 * Remplace les <option> de `sel` seulement si `html` a changé, puis sélectionne `value`.
	 * value non fourni (undefined) : garde la sélection en cours si elle existe encore.
	 * Tant que le menu a le focus, rien n'est touché (il se refermerait sous la souris) : la dernière mise à jour demandée
	 * s'applique toute seule quand il le perd, en gardant le choix fait entre-temps par l'utilisateur.
	 * Renvoie true si le menu a été mis à jour tout de suite.
	 */
	KBD.fillSelect = (sel, html, value) => {
		const s = byId(sel);
		if (!s) return false;
		if (document.activeElement === s) {
			if (!selectPending.has(s)) {
				s.addEventListener('focusout', () => {
					const p = selectPending.get(s);
					if (p) applySelect(s, p.html, s.value !== p.shown ? undefined : p.value);
				}, { once: true });
			}
			selectPending.set(s, { html, value, shown: s.value });
			return false;
		}
		applySelect(s, html, value);
		return true;
	};

	/**
	 * <option> des équipes (replicant teams), triées par nom, l'équipe `selectedId` marquée selected.
	 *  - empty : libellé de l'option vide (valeur '') en tête, ou null pour ne pas en mettre
	 *  - teams : liste d'équipes à proposer à la place (ex. KB.orderedTeams() pour mettre celles du match en tête)
	 *  - label : (team) => texte de l'option (par défaut « Nom (TAG) ») ; il est échappé ici
	 * Une équipe choisie mais introuvable reste proposée (« id (inconnue) ») pour ne pas perdre la valeur.
	 */
	KBD.teamOptions = (selectedId, { empty = '—', teams = null, label = null } = {}) => {
		const list = teams || Object.values(KB.rep.teams.value || {}).sort((a, b) => String(a.name).localeCompare(String(b.name)));
		const text = label || ((t) => `${t.name}${t.tag ? ' (' + t.tag + ')' : ''}`);
		const opt = (value, txt) => `<option value="${KB.esc(value)}"${value === (selectedId || '') ? ' selected' : ''}>${KB.esc(txt)}</option>`;
		let html = empty == null || empty === false ? '' : opt('', empty);
		for (const t of list) html += opt(t.id, text(t));
		if (selectedId && !list.some((t) => t.id === selectedId)) html += opt(selectedId, selectedId + ' (inconnue)');
		return html;
	};

	// ---------- Chemins 'a.b.c' ----------
	const keysOf = (path) => (Array.isArray(path) ? path : String(path).split('.'));
	/** Valeur à un chemin ('a.b.0.c' ou ['a', 'b']) ; undefined si un maillon manque. */
	KBD.getPath = (obj, path) => keysOf(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
	/** Écrit `value` au chemin (crée les objets intermédiaires manquants ; n'écrit pas si la valeur est déjà la même). Renvoie obj. */
	KBD.setPath = (obj, path, value) => {
		const keys = keysOf(path);
		let o = obj;
		for (const k of keys.slice(0, -1)) o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {};
		const last = keys[keys.length - 1];
		if (o[last] !== value) o[last] = value;
		return obj;
	};

	// ---------- Brouillon local d'un formulaire ----------
	const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	// Copie figée : la valeur d'un replicant continue de changer après lecture
	const snapshot = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
	/**
	 * Formulaire qui prépare une valeur avant de l'envoyer à l'antenne (lower third, ticker, casters…).
	 *  - read()   : valeur actuelle du formulaire
	 *  - fill(v)  : remplit le formulaire avec v
	 *  - live()   : valeur à l'antenne (lue dans le replicant)
	 *  - same(a, b) : comparaison (JSON par défaut)
	 *  - onState(dirty) : appelé à chaque changement (afficher « Non appliqué », activer « Mettre à jour »…)
	 * sync() est à appeler à chaque changement du replicant : le formulaire est rechargé depuis l'antenne
	 * s'il n'a pas le focus et n'a pas été modifié depuis son dernier chargement ; sinon le brouillon est gardé.
	 */
	KBD.bindDirty = (container, { read, fill, live, same = sameJson, onState = null }) => {
		const box = byId(container);
		let base; // dernière valeur chargée dans le formulaire
		const isDirty = () => !same(read(), live());
		const state = () => { if (onState) onState(isDirty()); };
		const sync = () => {
			const cur = live();
			if (cur === undefined) return;
			const load = () => { base = snapshot(cur); fill(snapshot(cur)); };
			if (base === undefined) load();
			else if (same(read(), cur)) base = snapshot(cur); // formulaire identique à l'antenne : il la suit de nouveau
			else if (same(read(), base) && !box.contains(document.activeElement)) load();
			state();
		};
		box.addEventListener('input', state);
		box.addEventListener('change', state);
		// Un changement arrivé pendant la saisie est repris à la sortie du formulaire (si le brouillon n'a pas été modifié)
		box.addEventListener('focusout', () => setTimeout(sync, 0));
		return { sync, isDirty };
	};

	/** Copie `text`. L'API Clipboard n'existe qu'en HTTPS ou sur localhost : sinon, repli par sélection + copie. */
	KBD.copy = async (text) => {
		try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch { /* repli */ }
		const ta = document.createElement('textarea');
		ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
		document.body.appendChild(ta); ta.select();
		let ok;
		try { ok = document.execCommand('copy'); } catch { ok = false; }
		ta.remove();
		return ok;
	};

	window.KBD = KBD;
})();
