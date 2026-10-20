const additions = require('../data/abuja-additions.json');
const { pool, withTransaction } = require('../src/config/db');
const { insideFCT } = require('../src/lib/geo');

const categories = [
  ['Shopping & Markets', 'Markets, shopping centres and local trading destinations'],
  ['Hotels & Leisure', 'Visitor accommodation, dining and leisure venues'],
];

async function main() {
  const inserted = await withTransaction(async (conn) => {
    for (const [name, description] of categories) {
      const [[existing]] = await conn.execute('SELECT category_id FROM Categories WHERE category_name = ?', [name]);
      if (!existing) await conn.execute('INSERT INTO Categories (category_name, description) VALUES (?, ?)', [name, description]);
    }
    const [rows] = await conn.query('SELECT category_id, category_name FROM Categories');
    const ids = Object.fromEntries(rows.map((r) => [r.category_name, r.category_id]));
    let count = 0;
    for (const a of additions) {
      if (!a.verified || !insideFCT(a.latitude, a.longitude) || !ids[a.category]) {
        throw new Error(`Invalid catalog entry: ${a.name}`);
      }
      const [[existing]] = await conn.execute('SELECT attraction_id FROM Attractions WHERE LOWER(name) = LOWER(?)', [a.name]);
      if (existing) continue;
      await conn.execute(
        `INSERT INTO Attractions (name, category_id, description, latitude, longitude, address, image_url, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'curated', 'active')`,
        [a.name, ids[a.category], a.description, a.latitude, a.longitude, a.address, a.image_url]
      );
      count += 1;
    }
    return count;
  });
  const [[counts]] = await pool.query("SELECT COUNT(*) AS curated_count FROM Attractions WHERE source = 'curated'");
  console.log(`Added ${inserted} places. Curated catalog: ${counts.curated_count}.`);
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());
