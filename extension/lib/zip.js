// Archive ZIP envoyée en flux (sans compression : les PNG le sont déjà), sans dépendance.
//   sendZip(res, filename, entries) : entries = [{ name: 'dossier/fichier.png', file: '/chemin/absolu' }]
// Taille annoncée d'avance (Content-Length : le navigateur affiche la progression du téléchargement).
// Un fichier est lu entier pour son CRC avant d'être écrit : convient à des images, pas à des fichiers de plusieurs Go.
// Limites du format ZIP classique (sans ZIP64) : 65 535 fichiers, 4 Go au total.
const fs = require('fs');
const zlib = require('zlib');

const MAX = 0xffffffff;

// Date et heure au format MS-DOS (heure locale, précision 2 s)
function dosTime(d) {
	return {
		time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
		date: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
	};
}

async function sendZip(res, filename, entries) {
	const items = await Promise.all(entries.map(async (e) => {
		const st = await fs.promises.stat(e.file);
		return { ...e, size: st.size, name: Buffer.from(e.name, 'utf8'), ...dosTime(st.mtime) };
	}));
	const data = items.reduce((n, it) => n + 30 + it.name.length + it.size, 0);
	const dir = items.reduce((n, it) => n + 46 + it.name.length, 0);
	if (items.length > 0xffff || data + dir + 22 > MAX) throw new Error('Export trop volumineux pour une archive ZIP');

	res.set({
		'Content-Type': 'application/zip',
		'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
		'Content-Length': String(data + dir + 22),
		'Cache-Control': 'no-store',
	});
	// Respecte le débit du client : on attend que le tampon se vide avant d'envoyer le fichier suivant
	const write = (buf) => new Promise((resolve, reject) => {
		if (res.destroyed) return reject(new Error('Téléchargement interrompu'));
		if (res.write(buf)) resolve();
		else { res.once('drain', resolve); res.once('close', () => reject(new Error('Téléchargement interrompu'))); }
	});

	let offset = 0;
	const central = [];
	for (const it of items) {
		const body = await fs.promises.readFile(it.file);
		if (body.length !== it.size) throw new Error(`Fichier modifié pendant le téléchargement : ${it.name}`);
		const crc = zlib.crc32(body);
		// En-tête local : version 2.0, drapeau 0x0800 (noms en UTF-8), méthode 0 (stockage)
		const h = Buffer.alloc(30);
		h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
		h.writeUInt16LE(it.time, 10); h.writeUInt16LE(it.date, 12); h.writeUInt32LE(crc, 14);
		h.writeUInt32LE(it.size, 18); h.writeUInt32LE(it.size, 22); h.writeUInt16LE(it.name.length, 26); h.writeUInt16LE(0, 28);
		await write(Buffer.concat([h, it.name]));
		await write(body);
		const c = Buffer.alloc(46);
		c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
		c.writeUInt16LE(it.time, 12); c.writeUInt16LE(it.date, 14); c.writeUInt32LE(crc, 16);
		c.writeUInt32LE(it.size, 20); c.writeUInt32LE(it.size, 24); c.writeUInt16LE(it.name.length, 28);
		c.writeUInt32LE(offset, 42); // champs extra, commentaire, disque, attributs : 0
		central.push(Buffer.concat([c, it.name]));
		offset += 30 + it.name.length + it.size;
	}
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(items.length, 8); end.writeUInt16LE(items.length, 10);
	end.writeUInt32LE(dir, 12); end.writeUInt32LE(offset, 16);
	await write(Buffer.concat([...central, end]));
	res.end();
}

module.exports = { sendZip };
