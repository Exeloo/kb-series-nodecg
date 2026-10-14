// Content script injecté dans la régie NodeCG (local :9090 ou domaine en HTTPS, y compris les iframes des panneaux).
// Relaie window.postMessage (page) <-> service worker de l'extension.
//   page -> extension : { source: 'kb-tracker-page', id, type: 'ping' }            -> { source: 'kb-tracker-ext', id, type: 'pong', version }
//   page -> extension : { source: 'kb-tracker-page', id, type: 'import', riotId, playlist }
//                       -> { type: 'status', state, message }* puis { type: 'result', ok, riotId, message }
// Chrome et Firefox : le même fichier sert aux deux.
(() => {
	const PAGE = 'kb-tracker-page';
	const EXT = 'kb-tracker-ext';
	let version = '?';
	try { version = chrome.runtime.getManifest().version; } catch { /* contexte invalidé */ }

	const reply = (id, msg) => window.postMessage({ source: EXT, id, ...msg }, location.origin);
	// Firefox : un fetch de content script part avec l'identité de l'extension (pas de cookies de la régie, et
	// Sec-Fetch-Site ≠ same-origin → refusé par la garde sameOrigin). content.fetch envoie la requête au nom de la page.
	// Chrome : le fetch d'un content script est déjà celui de la page (content n'existe pas).
	/* global content */
	const pageFetch = typeof content !== 'undefined' && content && typeof content.fetch === 'function' ? content.fetch.bind(content) : fetch;

	window.addEventListener('message', (e) => {
		if (e.source !== window || !e.data || e.data.source !== PAGE) return;
		const { id, type } = e.data;

		if (type === 'ping') {
			// Répond directement (pas besoin de réveiller le service worker) : < 300 ms garanti
			let alive;
			try { alive = !!chrome.runtime.id; } catch { alive = false; }
			if (alive) reply(id, { type: 'pong', version });
			return;
		}

		if (type === 'import') {
			let port;
			try {
				port = chrome.runtime.connect({ name: 'kb-import' });
			} catch {
				reply(id, { type: 'result', ok: false, riotId: e.data.riotId, message: 'Extension rechargée : recharge cette page (F5) puis réessaie.' });
				return;
			}
			let done = false;
			// Messages réguliers sur le port : gardent le service worker éveillé pendant un import long (vérification Cloudflare)
			const keepAlive = setInterval(() => { try { port.postMessage({ type: 'keepalive' }); } catch { /* port fermé */ } }, 20000);
			port.onMessage.addListener((msg) => {
				if (!msg) return;
				if (msg.type === 'post') {
					// Envoi du JSON tracker.gg à NodeCG depuis la page (même origine → cookies de connexion inclus)
					pageFetch(location.origin + '/valorant-tournament/tracker-import?playlist=' + encodeURIComponent(msg.playlist || 'competitive'), {
						method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: msg.text, credentials: 'include',
					})
						// Lu en texte puis parsé ici : sous Firefox, l'objet renvoyé par content.fetch appartient à la page
						.then((r) => r.text().then((t) => { try { return JSON.parse(t); } catch { return { ok: false, error: 'Réponse NodeCG invalide (HTTP ' + r.status + ')' }; } }))
						.then((j) => { try { port.postMessage({ type: 'posted', ok: !!j.ok, riotId: j.riotId, error: j.error }); } catch { /* port fermé */ } })
						.catch((err) => { try { port.postMessage({ type: 'posted', ok: false, error: 'NodeCG injoignable : ' + err.message }); } catch { /* */ } });
					return;
				}
				if (msg.type === 'status') reply(id, { type: 'status', state: msg.state, message: msg.message, riotId: e.data.riotId });
				if (msg.type === 'result') {
					done = true;
					clearInterval(keepAlive);
					reply(id, { type: 'result', ok: !!msg.ok, riotId: msg.riotId || e.data.riotId, message: msg.message });
					try { port.disconnect(); } catch { /* déjà fermé */ }
				}
			});
			port.onDisconnect.addListener(() => {
				clearInterval(keepAlive);
				if (!done) reply(id, { type: 'result', ok: false, riotId: e.data.riotId, message: 'Import interrompu (extension rechargée ou fermée).' });
			});
			port.postMessage({ type: 'import', riotId: e.data.riotId, playlist: e.data.playlist || 'competitive' });
		}
	});

	// Annonce spontanée (utile si la page a pingé avant l'injection du script)
	window.postMessage({ source: EXT, type: 'hello', version }, location.origin);
})();
