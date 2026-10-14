// Panneau « Équipes & Joueurs » : aperçu fusionné (KB.player = ce que verront les overlays) et import tracker.gg.
// Trois façons d'importer : extension compagnon Chrome / Edge / Firefox (KBI.request), favori « ⇪ Envoyer à NodeCG » (KBI.bookmarklet),
// copier-coller du JSON de l'API (route POST /valorant-tournament/tracker-import). État lu sur GET …/tracker-status.
(function (P) {
	const $ = KB.$;
	const esc = KB.esc;

	// ---------- Extension compagnon (Chrome, Edge, Firefox) ----------
	// Le guide d'installation affiché dépend du navigateur de la régie (l'extension doit être dans ce même navigateur)
	const FIREFOX = /firefox/i.test(navigator.userAgent);
	const helpLink = '<a href="/valorant-tournament/tracker-extension" target="_blank">Guide d\'installation</a>';
	let extOk = null;
	let extDir = null;
	async function checkExt() { $('#extTxt').textContent = 'Recherche de l\'extension…'; extOk = await KBI.hasExtension(); renderExt(); }
	function renderExt() {
		$('#extDot').className = 'dot' + (extOk ? ' on' : '');
		$('#extTxt').innerHTML = extOk
			? `<b>Extension tracker.gg détectée</b>${KBI.extensionVersion() ? ' v' + esc(KBI.extensionVersion()) : ''} · import auto`
			: extOk === false ? `<b>Extension non détectée</b> · import via le favori · ${helpLink}` : 'Recherche de l\'extension…';
		$('#extHelp').innerHTML = extOk
			? `<b>Extension active :</b> « + » d'une colonne ou « Importer depuis tracker.gg » sur la fiche ouvre tracker.gg en arrière-plan, récupère les stats et referme l'onglet. ${helpLink}`
			: FIREFOX
				? `<b>Import en 1 clic :</b> installe l'extension compagnon dans Firefox (fichier <code class="path">manifest.json</code> du dossier <code class="path">${esc(extDir || 'tools/tracker-extension')}</code>, à charger depuis <code class="path">about:debugging</code>, ou version signée), autorise son accès aux sites (clic sur son icône), puis recharge la régie. ${helpLink}. En attendant, utilise le favori ci-dessous.`
				: `<b>Import en 1 clic :</b> installe l'extension compagnon (dossier <code class="path">${esc(extDir || 'tools/tracker-extension')}</code>, à charger en « non empaquetée » depuis <code class="path">chrome://extensions</code>, ou <code class="path">edge://extensions</code>), puis recharge la régie. ${helpLink}. En attendant, utilise le favori ci-dessous.`;
	}
	fetch('/valorant-tournament/tracker-status').then((r) => r.json()).then((j) => { extDir = j.extension && j.extension.dir; renderExt(); }).catch(() => {});
	$('#extRetry').onclick = checkExt;
	KBI.ready.then((v) => { extOk = v; renderExt(); });
	window.addEventListener('message', (e) => { if (e.source === window && e.data && e.data.source === 'kb-tracker-ext' && e.data.type === 'hello' && !extOk) { extOk = true; renderExt(); } });
	renderExt();

	// ---------- Import d'un joueur ----------
	P.inFlight = new Set();
	// Import par le favori : la page tracker.gg est ouverte, on attend que le profil arrive pour le confirmer ici
	let waiting = null; // { key, fetchedAt, msgEl }
	const resultCls = (r) => (r.ok ? 'ok' : r.via === 'manual' ? 'info' : 'err');
	/** À appeler directement dans un clic (ou Entrée) : l'ouverture d'un onglet tracker.gg doit rester autorisée */
	P.runImport = (key, riotId, msgEl) => {
		P.inFlight.add(key);
		const p = KBI.request(riotId, { onStatus: (s) => P.msg(msgEl, `${riotId} : ${s.message}`, 'info') });
		if (extOk !== false) P.msg(msgEl, 'Import de ' + riotId + '…', 'info');
		P.renderAll();
		p.then((r) => {
			P.msg(msgEl, r.message, resultCls(r));
			const prof = P.profVal()[key];
			waiting = r.via === 'manual' ? { key, fetchedAt: prof && prof.fetchedAt, msgEl } : null;
		}).finally(() => { P.inFlight.delete(key); P.renderAll(); });
	};
	/** Signale l'arrivée du profil attendu (import par le favori) */
	P.checkArrival = () => {
		if (!waiting) return;
		const prof = P.profVal()[waiting.key];
		if (!prof || prof.fetchedAt === waiting.fetchedAt) return;
		P.msg(waiting.msgEl, `✔ ${prof.riotId} importé depuis tracker.gg.`, 'ok');
		waiting = null;
	};

	// ---------- Favori « ⇪ Envoyer à NodeCG » ----------
	$('#bookmarklet').href = KBI.bookmarklet();
	$('#bookmarklet').addEventListener('click', (e) => { e.preventDefault(); P.msg('#importMsg', 'Glisse ce bouton dans ta barre de favoris, ne clique pas dessus ici.', 'info'); });

	// ---------- Copier-coller du JSON ----------
	$('#importJson').onclick = () => {
		const body = $('#json').value.trim();
		if (!body) return P.msg('#importMsg', 'Colle d\'abord le JSON de la page API tracker.gg dans la zone ci-dessus.', 'err');
		try { JSON.parse(body); } catch {
			return P.msg('#importMsg', 'Ce texte n\'est pas du JSON valide : sur la page API, fais Ctrl+A puis Ctrl+C et colle tout le contenu.', 'err');
		}
		// En HTTP plutôt que par socket : le JSON tracker.gg peut dépasser la limite de taille des messages
		fetch('/valorant-tournament/tracker-import', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body })
			.then((r) => r.json())
			.then((j) => {
				if (!j.ok) throw new Error(j.error);
				$('#json').value = '';
				P.select(KB.key(j.riotId));
				P.msg('#importMsg', '✔ ' + j.riotId + ' importé : sa fiche est ouverte.', 'ok');
			})
			.catch((err) => P.msg('#importMsg', 'Import refusé : ' + String(err.message || err), 'err'));
	};

	// ---------- Aperçu fusionné (KB.player) ----------
	P.renderPreview = () => {
		const has = P.sel && P.allKeys().has(P.sel);
		const api = $('#apiLink');
		api.href = has ? KBI.apiUrl(P.riotIdOf(P.sel)) : '#';
		api.textContent = has ? `le lien API de ${P.riotIdOf(P.sel)}` : 'le lien API du joueur (ouvre d\'abord sa fiche)';
		if (!has) { $('#preview').innerHTML = '<div class="empty">Aucun joueur sélectionné.</div>'; return; }
		const p = KB.player(P.riotIdOf(P.sel));
		const ov = P.ovOf(P.sel);
		const statCell = ([k, l]) => { const s = p.stats[k]; return `<div class="pv-stat${s && s.manual ? ' m' : ''}"><small>${esc(l)}</small><b>${esc((s && s.display) || '–')}</b></div>`; };
		const rk = (r, l, m) => `<span class="${m ? 'm' : ''}">${r && r.icon ? `<img src="${esc(r.icon)}" alt="">` : ''}<span><small>${l}</small>${esc((r && r.name) || '–')}</span></span>`;
		const bust = p.agents[0] && p.agents[0].bust;
		$('#preview').innerHTML = `<div class="preview" style="--c:${esc((p.team && p.team.color) || 'var(--line)')}">
			<div class="pv-photo">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : bust ? `<img class="ghost" src="${esc(bust)}" alt="" title="Pas de photo : agent principal">` : '<span>Pas de photo</span>'}</div>
			<div class="pv-main">
				<div class="pv-name">${esc(p.name)} <span>#${esc(p.tag)}</span></div>
				<div class="pv-meta">${p.team ? `<b>${esc(p.team.name)}</b>` : 'Sans équipe'}${p.role ? ' · ' + esc(KB.roleLabel(p.role)) : ''}${p.realName ? ' · ' + esc(p.realName) : ''}${p.level ? ' · niveau ' + esc(p.level) : ''}${p.hasTracker ? '' : ' · <span class="c-gold">sans tracker.gg</span>'}</div>
				<div class="pv-ranks">${rk(p.rank, 'Rang', ov.rank && ov.rank.name)}${rk(p.peak, 'Peak', ov.peak && ov.peak.name)}</div>
				<div class="pv-stats">${P.STATS.map(statCell).join('')}</div>
				<div class="pv-agents">${p.agents.length ? p.agents.slice(0, 3).map((a) => `<div class="pv-agent${a.manual ? ' m' : ''}" style="--ac:${esc(a.color || 'var(--line)')}">${a.icon ? `<img src="${esc(a.icon)}" alt="">` : ''}<span>${esc(a.name)}${a.matches ? ` <small>${esc(a.matches)} m.</small>` : ''}</span></div>`).join('') : '<span class="empty">Aucun agent</span>'}</div>
			</div>
		</div>`;
	};
})(window.KBPlayers ||= {});
