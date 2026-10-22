// Registre unique des overlays pilotables depuis la régie → window.KBO
// <script src="../shared/overlays.js"></script>  (après kb.js et overlay-list.js)
//
//   KBO.ITEMS                      [{ id, label, group, rep, path, fullscreen, hint?(v), needs?(v) }]
//   KBO.GROUPS                     noms des groupes, dans l'ordre d'affichage
//   KBO.item(id)                   entrée du registre (ou null)
//   KBO.repNames() / KBO.reps()    replicants de visibilité + fullscreenStinger (noms pour KB.watch / objets Replicant)
//   KBO.isVisible(id)
//   KBO.show(id, { exclusive?, stinger? })   un plein écran masque les autres plein écran si KBO.exclusive (ou exclusive: true)
//   KBO.hide(id, { stinger? }) / KBO.toggle(id)
//                                  option « transition des plein écran » active (replicant fullscreenStinger) : un plein écran
//                                  est affiché / masqué par le serveur au point de coupe du stinger (message 'overlay:stinger').
//                                  stinger: false = tout de suite (action déjà faite pendant une transition)
//   KBO.stinger                    option « transition des plein écran » (lecture / écriture, commune à toute la régie)
//   KBO.hideAll({ fullscreenOnly })
//   KBO.exclusive                  préférence « un seul plein écran à la fois » (lecture / écriture, mémorisée dans ce navigateur)
//   KBO.button(id) / KBO.row(id)   HTML d'un bouton bascule AFFICHER / ● À L'ANTENNE (ou d'une ligne .ovrow complète)
//   KBO.bind(container)            branche les clics des boutons [data-ov] du conteneur (une seule fois)
(function () {
	const KBO = {};
	const playerName = (id) => (id ? (KB.player(id) || {}).name || String(id).split('#')[0] : '?');
	// Lower third : nom de l'intervenant suivi (host, caster) ou titre saisi
	const ltHint = (s) => {
		if (s && s.source === 'caster') {
			const c = (KB.rep.casters.value || [])[+s.casterIndex || 0];
			return c ? `${c.role === 'host' ? 'Host' : 'Caster'} : ${c.name || '(sans nom)'}` : 'Intervenant supprimé';
		}
		return (s && s.title) || 'Contenu à régler dans Live';
	};

	// Liste des overlays : shared/overlay-list.js (commune avec le serveur) ; ici, la précision affichée sous le nom
	const HINTS = {
		'lower-third-left': (v) => ltHint(v.left),
		'lower-third-center': (v) => ltHint(v.center),
		'lower-third-right': (v) => ltHint(v.right),
		'map-result': (v) => (v.result && v.result.mvp ? 'MVP : ' + playerName(v.result.mvp) : ''),
		'player-stats': (v) => (v.playerId ? playerName(v.playerId) : 'Aucun joueur choisi (panneau Stats Joueur)'),
		'player-duel': (v) => playerName(v.left) + ' vs ' + playerName(v.right),
	};
	KBO.ITEMS = KBOList.ITEMS.map((it) => (HINTS[it.id] ? { ...it, hint: HINTS[it.id] } : it));
	KBO.GROUPS = [...new Set(KBO.ITEMS.map((it) => it.group))];
	KBO.item = (id) => KBO.ITEMS.find((it) => it.id === id) || null;

	// ---------- Replicants ----------
	const reps = {};
	const rep = (name) => (reps[name] ||= nodecg.Replicant(name));
	KBO.repNames = () => [...new Set(KBO.ITEMS.map((it) => it.rep)), 'fullscreenStinger'];
	KBO.reps = () => KBO.repNames().map(rep);
	/** Valeur du replicant d'un overlay ({} tant qu'elle n'est pas connue) */
	KBO.value = (id) => { const it = KBO.item(id); return (it && rep(it.rep).value) || {}; };

	// Côté navigateur, la valeur d'un replicant n'est mise à jour qu'au retour du serveur : les changements demandés
	// dans le même instant sont regroupés (le dernier gagne) puis envoyés ensemble, et la lecture en tient compte.
	const queued = new Map(); // item → visible voulu
	const actual = (it) => !!it.path.reduce((o, k) => (o ? o[k] : undefined), rep(it.rep).value);
	const read = (it) => (queued.has(it) ? queued.get(it) : actual(it));
	KBO.isVisible = (id) => { const it = KBO.item(id); return !!it && read(it); };

	const isObj = (v) => !!v && typeof v === 'object';
	// Écrit `value` au chemin `path` sous `obj` ; un maillon manquant est créé d'un coup avec la valeur au bout
	function writeAt(obj, path, value) {
		const [k, ...rest] = path;
		if (!rest.length) obj[k] = value;
		else if (isObj(obj[k])) writeAt(obj[k], rest, value);
		else obj[k] = rest.reduceRight((v, key) => ({ [key]: v }), value);
	}
	/**
	 * Écrit seulement les booléens de visibilité, champ par champ (le reste du replicant n'est pas réécrit,
	 * une modification faite au même moment par un autre panneau est donc préservée). Les maillons manquants sont créés.
	 */
	function flush() {
		const changes = [...queued];
		queued.clear();
		const fresh = {}; // replicants sans valeur : créés en une fois avec tous leurs changements
		for (const [it, on] of changes) {
			const r = rep(it.rep);
			if (isObj(r.value)) writeAt(r.value, it.path, on);
			else writeAt(fresh[it.rep] ||= {}, it.path, on);
		}
		for (const [name, v] of Object.entries(fresh)) rep(name).value = v;
	}
	const set = (it, on) => {
		if (!queued.size) queueMicrotask(flush);
		queued.set(it, on);
	};

	// ---------- Préférence « un seul plein écran à la fois » (même clé que la régie) ----------
	const EXCL_KEY = 'kb-regie-exclusive';
	let exclusiveMem = true; // si le stockage local est indisponible
	Object.defineProperty(KBO, 'exclusive', {
		enumerable: true,
		get() { try { return localStorage.getItem(EXCL_KEY) !== '0'; } catch { return exclusiveMem; } },
		set(on) { exclusiveMem = !!on; try { localStorage.setItem(EXCL_KEY, on ? '1' : '0'); } catch { /* stockage bloqué */ } },
	});

	// ---------- Transition des plein écran (réglage commun à toute la régie et à l'API Companion) ----------
	const fsRep = () => rep('fullscreenStinger');
	Object.defineProperty(KBO, 'stinger', {
		enumerable: true,
		get() { return !!(fsRep().value && fsRep().value.enabled); },
		set(on) { fsRep().value = { ...(fsRep().value || KBOList.STINGER_DEFAULT), enabled: !!on }; },
	});
	// Le serveur joue le stinger et fait le changement à la coupe (extension/companion.js) : rien n'est écrit ici
	const sting = (it, action, exclusive) => nodecg.sendMessage('overlay:stinger', { id: it.id, action, exclusive })
		.catch((e) => console.warn(`Transition ${it.label} impossible :`, (e && e.message) || e));

	// ---------- Afficher / masquer ----------
	KBO.show = (id, { exclusive = KBO.exclusive, stinger = true } = {}) => {
		const it = KBO.item(id);
		if (!it) return;
		if (it.fullscreen && stinger && KBO.stinger) return void sting(it, 'show', exclusive);
		if (it.fullscreen && exclusive) for (const o of KBO.ITEMS) if (o !== it && o.fullscreen && read(o)) set(o, false);
		set(it, true);
	};
	KBO.hide = (id, { stinger = true } = {}) => {
		const it = KBO.item(id);
		if (!it) return;
		if (it.fullscreen && stinger && KBO.stinger) { if (read(it)) sting(it, 'hide'); return; }
		set(it, false);
	};
	KBO.toggle = (id) => (KBO.isVisible(id) ? KBO.hide(id) : KBO.show(id));
	KBO.hideAll = ({ fullscreenOnly = false } = {}) => { for (const it of KBO.ITEMS) if ((!fullscreenOnly || it.fullscreen) && read(it)) set(it, false); };

	// ---------- Bouton bascule uniforme ----------
	/** Bouton AFFICHER / ● À L'ANTENNE ; désactivé si l'overlay n'a rien à afficher (needs) et n'est pas à l'antenne */
	KBO.button = (id) => {
		const it = KBO.item(id);
		if (!it) return '';
		const on = read(it);
		const blocked = !on && it.needs && !it.needs(KBO.value(id));
		return `<button type="button" data-ov="${KB.esc(id)}"${on ? ' class="onair" title="Cliquer pour masquer"' : ''}${blocked ? ' disabled' : ''}>${on ? '● À L\'ANTENNE' : 'AFFICHER'}</button>`;
	};
	/** Ligne complète : pastille + nom (+ précision) + bouton */
	KBO.row = (id) => {
		const it = KBO.item(id);
		if (!it) return '';
		const hint = it.hint ? it.hint(KBO.value(id)) : '';
		return `<div class="ovrow" data-ovrow="${KB.esc(id)}"><span class="dot${read(it) ? ' on' : ''}"></span>`
			+ `<span class="name">${KB.esc(it.label)}${hint ? `<small>${KB.esc(hint)}</small>` : ''}</span>${KBO.button(id)}</div>`;
	};
	const bound = new WeakSet();
	/** Clic sur un bouton [data-ov] du conteneur → bascule (le contenu peut être re-rendu librement) */
	KBO.bind = (container) => {
		const box = typeof container === 'string' ? document.querySelector(container) : container;
		if (!box || bound.has(box)) return box;
		bound.add(box);
		box.addEventListener('click', (e) => {
			const b = e.target.closest('button[data-ov]');
			if (b && box.contains(b) && !b.disabled) KBO.toggle(b.dataset.ov);
		});
		return box;
	};

	window.KBO = KBO;
})();
