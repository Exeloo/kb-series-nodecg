// Stats joueur tracker.gg : normalisation du JSON brut de l'API et stockage.
// tracker.gg bloque les requêtes serveur (Cloudflare, 403) : le JSON est récupéré dans le navigateur de l'utilisateur
// (extension compagnon Chrome / Edge / Firefox, favori ou copier-coller) puis envoyé à la route POST tracker-import (tracker-routes.js).
// Replicant : playerProfiles { [riotId en minuscules]: profil normalisé } ; JSON bruts gardés dans db/tracker/.
// Au démarrage, un profil sans stats par rôle (import ancien) est re-normalisé depuis son JSON brut.
//   normalize(raw, playlist) → profil (lève une erreur lisible si le JSON est inutilisable)
const fs = require('fs');
const path = require('path');
const { TRACKER } = require('./lib/paths');

const VAPI = 'https://media.valorant-api.com';
// Riot ID : pseudo (≤ 16 caractères chez Riot) + tag (3 à 5) ; bornes larges pour ne refuser que l'absurde
const RIOT_ID = /^[^#]{1,32}#[^#]{1,8}$/;

const dv = (stat) => (stat ? stat.displayValue : null);
const num = (stat) => (stat && typeof stat.value === 'number' ? stat.value : null);
const pct = (stat) => (stat && typeof stat.percentile === 'number' ? stat.percentile : null);
const uuidFrom = (url) => (typeof url === 'string' && url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [null])[0];
// Seules des images https:// sont reprises (le JSON vient du navigateur : on ne lui fait pas confiance)
const img = (url) => (typeof url === 'string' && /^https:\/\//i.test(url) ? url : null);

function normalize(raw, playlist = 'competitive') {
	const d = raw && raw.data;
	if (!d || !Array.isArray(d.segments)) {
		const msg = raw && Array.isArray(raw.errors) && raw.errors[0] && raw.errors[0].message;
		throw new Error(msg || 'JSON tracker.gg invalide (pas de "data.segments")');
	}
	const info = d.platformInfo || {};
	const riotId = info.platformUserHandle || info.platformUserIdentifier;
	if (typeof riotId !== 'string' || !RIOT_ID.test(riotId)) throw new Error('JSON tracker.gg invalide (Riot ID absent ou incorrect)');
	const [name, tag] = riotId.split('#');
	const segs = d.segments.filter((s) => s && typeof s === 'object');
	const inPlaylist = (s) => !s.attributes?.playlist || s.attributes.playlist === playlist;

	const season = segs.find((s) => s.type === 'season' && s.attributes?.playlist === playlist)
		|| segs.find((s) => s.type === 'season');
	if (!season) throw new Error(`Aucune stat de saison trouvée (profil privé ou aucune partie en ${playlist} ?)`);
	const st = season.stats || {};
	const peakSeg = segs.find((s) => s.type === 'peak-rating' && inPlaylist(s));
	const peakStats = (peakSeg && peakSeg.stats) || {};
	const peakStat = peakStats.peakRating || Object.values(peakStats)[0];

	const statKeys = {
		matches: 'matchesPlayed', wins: 'matchesWon', losses: 'matchesLost', winPct: 'matchesWinPct',
		kd: 'kDRatio', kda: 'kDARatio', acs: 'scorePerRound', adr: 'damagePerRound', hs: 'headshotsPercentage',
		kast: 'kAST', kills: 'kills', deaths: 'deaths', assists: 'assists', killsPerRound: 'killsPerRound',
		firstBloods: 'firstBloods', firstDeaths: 'firstDeaths', clutches: 'clutches', aces: 'aces', mvps: 'mVPs',
		mostKills: 'mostKillsInMatch', timePlayed: 'timePlayed', trn: 'trnPerformanceScore',
	};
	const stats = {};
	for (const [k, key] of Object.entries(statKeys)) {
		stats[k] = { display: dv(st[key]), value: num(st[key]), percentile: pct(st[key]) };
	}

	const of = (type) => segs.filter((s) => s.type === type && inPlaylist(s)).map((s) => ({ ...s, stats: s.stats || {}, metadata: s.metadata || {}, attributes: s.attributes || {} }));

	const agents = of('agent')
		.sort((a, b) => (num(b.stats.timePlayed) || 0) - (num(a.stats.timePlayed) || 0))
		.map((s) => {
			const id = s.attributes.key;
			return {
				id,
				name: s.metadata.name,
				role: s.metadata.role,
				color: s.metadata.color,
				icon: img(s.metadata.imageUrl),
				portrait: `${VAPI}/agents/${encodeURIComponent(id)}/fullportrait.png`,
				bust: `${VAPI}/agents/${encodeURIComponent(id)}/bustportrait.png`,
				matches: dv(s.stats.matchesPlayed),
				winPct: dv(s.stats.matchesWinPct),
				kd: dv(s.stats.kDRatio),
				adr: dv(s.stats.damagePerRound),
				acs: dv(s.stats.scorePerRound),
				timePlayed: dv(s.stats.timePlayed),
			};
		});

	const topAgents = of('map-top-agent');
	const maps = of('map')
		.sort((a, b) => (num(b.stats.matchesPlayed) || 0) - (num(a.stats.matchesPlayed) || 0))
		.map((s) => {
			const key = s.attributes.key;
			const top = topAgents.find((t) => t.attributes.mapKey === key);
			return {
				key,
				name: s.metadata.name,
				image: img(s.metadata.imageUrl),
				matches: dv(s.stats.matchesPlayed),
				matchesValue: num(s.stats.matchesPlayed),
				wins: num(s.stats.matchesWon),
				losses: num(s.stats.matchesLost),
				winPct: dv(s.stats.matchesWinPct),
				winValue: num(s.stats.matchesWinPct),
				roundsWinPct: dv(s.stats.roundsWinPct),
				attackWinPct: dv(s.stats.attackRoundsWinPct),
				defenseWinPct: dv(s.stats.defenseRoundsWinPct),
				kd: dv(s.stats.kDRatio),
				acs: dv(s.stats.scorePerRound),
				adr: dv(s.stats.damagePerRound),
				hs: dv(s.stats.headshotsPercentage),
				topAgent: top ? {
					name: top.metadata.name,
					icon: img(top.metadata.imageUrl),
					color: top.metadata.color,
					matches: dv(top.stats.matchesPlayed),
					winPct: dv(top.stats.matchesWinPct),
				} : null,
			};
		});

	const weapons = of('weapon')
		.sort((a, b) => (num(b.stats.kills) || 0) - (num(a.stats.kills) || 0))
		.slice(0, 5)
		.map((s) => ({
			name: s.metadata.name,
			image: img(s.metadata.imageUrl),
			kills: dv(s.stats.kills),
			hs: dv(s.stats.headshotsPercentage),
		}));

	// Performances par rôle (Duelist, Initiator, Controller, Sentinel), du plus joué au moins joué.
	// key = nom anglais en minuscules (mêmes clés que KB.ROLES) ; *Value = valeur numérique, pour comparer ou trier.
	const roles = of('agent-role')
		.filter((s) => typeof s.metadata.name === 'string' && s.metadata.name)
		.sort((a, b) => (num(b.stats.timePlayed) || 0) - (num(a.stats.timePlayed) || 0))
		.map((s) => ({
			key: s.metadata.name.toLowerCase(),
			name: s.metadata.name,
			// Icône servie par valorant-api.com (clé = UUID du rôle) : le CDN de tracker.gg ne les sert pas toutes (Sentinelle : 404)
			icon: uuidFrom(s.attributes.key) ? `${VAPI}/agents/roles/${uuidFrom(s.attributes.key)}/displayicon.png` : img(s.metadata.imageUrl),
			matches: dv(s.stats.matchesPlayed),
			matchesValue: num(s.stats.matchesPlayed),
			winPct: dv(s.stats.matchesWinPct),
			winValue: num(s.stats.matchesWinPct),
			kd: dv(s.stats.kDRatio),
			kdValue: num(s.stats.kDRatio),
			acs: dv(s.stats.scorePerRound),
			acsValue: num(s.stats.scorePerRound),
			adr: dv(s.stats.damagePerRound),
			adrValue: num(s.stats.damagePerRound),
			kast: dv(s.stats.kAST),
			kastValue: num(s.stats.kAST),
			timePlayed: dv(s.stats.timePlayed),
			timeValue: num(s.stats.timePlayed),
		}));

	const cardId = uuidFrom(info.avatarUrl);
	const rankMeta = (st.rank && st.rank.metadata) || {};
	const peakMeta = (peakStat && peakStat.metadata) || {};
	return {
		id: riotId.toLowerCase(),
		riotId,
		name,
		tag,
		level: d.metadata?.accountLevel,
		privacy: d.metadata?.privacy,
		card: cardId ? {
			small: `${VAPI}/playercards/${cardId}/smallart.png`,
			wide: `${VAPI}/playercards/${cardId}/wideart.png`,
			large: `${VAPI}/playercards/${cardId}/largeart.png`,
		} : null,
		avatar: img(info.avatarUrl),
		playlist,
		season: season.metadata?.name,
		rank: st.rank ? { name: rankMeta.tierName || st.rank.displayValue, icon: img(rankMeta.iconUrl) } : null,
		peak: peakStat ? { name: peakMeta.tierName || peakStat.displayValue, icon: img(peakMeta.iconUrl), act: peakMeta.actName } : null,
		stats,
		agents,
		roles,
		maps,
		weapons,
		trackerUrl: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotId)}/overview`,
		fetchedAt: Date.now(),
	};
}

const rawFile = (id) => path.join(TRACKER, id.replace(/[^a-z0-9_-]/gi, '_') + '.json');

module.exports = function (nodecg) {
	const profiles = nodecg.Replicant('playerProfiles');

	// Profils importés avant l'ajout des stats par rôle : re-normalisés depuis leur JSON brut (db/tracker/), sans ré-import.
	// La date d'import d'origine est gardée (les stats datent toujours de ce jour-là).
	const old = Object.values(profiles.value || {}).filter((p) => p && p.id && !Array.isArray(p.roles));
	if (old.length) {
		const next = { ...profiles.value };
		let done = 0;
		for (const p of old) {
			try {
				const fresh = normalize(JSON.parse(fs.readFileSync(rawFile(p.id), 'utf8')), p.playlist || 'competitive');
				if (fresh.id !== p.id) continue;
				next[p.id] = { ...fresh, fetchedAt: p.fetchedAt || fresh.fetchedAt };
				done++;
			} catch { /* JSON brut absent ou illisible : le profil reste tel quel (sans stats par rôle) */ }
		}
		if (done) {
			profiles.value = next;
			nodecg.log.info(`Stats par rôle ajoutées à ${done} profil(s) tracker.gg (depuis db/tracker/)`);
		}
	}

	// Normalise, garde le JSON brut (pour re-normaliser plus tard sans ré-importer) et enregistre le profil
	function store(raw, playlist) {
		const p = normalize(raw, playlist);
		try {
			fs.mkdirSync(TRACKER, { recursive: true });
			fs.writeFileSync(rawFile(p.id), JSON.stringify(raw));
		} catch (e) { nodecg.log.warn('Sauvegarde JSON brut impossible :', e.message); }
		profiles.value = { ...(profiles.value || {}), [p.id]: p };
		nodecg.log.info(`Stats importées : ${p.riotId} (${p.stats.matches.display} matchs)`);
		return p;
	}

	return { store };
};

module.exports.normalize = normalize;
