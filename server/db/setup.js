/**
 * Creates all tables and loads the seed data.
 *   npm run db:setup
 * WARNING: drops and recreates every table in DB_NAME.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const env = require('../src/config/env');

const CATEGORIES = [
  ['Historical Sites', 'Monuments, landmarks and places of historical importance'],
  ['Parks & Nature', 'Parks, gardens, hills, rock formations, waterfalls and green spaces'],
  ['Arts & Culture', 'Museums, galleries, craft villages and cultural centres'],
  ['Religious Sites', 'Places of worship of architectural or cultural interest'],
  ['Educational Sites', 'Libraries, science centres and places of learning'],
];

async function main() {
  const conn = await mysql.createConnection({ ...env.db, multipleStatements: true });
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await conn.query(schema);
    console.log('Schema created (8 tables).');

    for (const [name, description] of CATEGORIES) {
      await conn.execute('INSERT INTO Categories (category_name, description) VALUES (?, ?)', [name, description]);
    }
    const [cats] = await conn.query('SELECT category_id, category_name FROM Categories');
    const categoryId = Object.fromEntries(cats.map((c) => [c.category_name, c.category_id]));
    console.log(`Inserted ${cats.length} categories.`);

    const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@12345', 12);
    const userHash = await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'Tourist@12345', 12);
    const users = [
      ['System Administrator', 'Admin', process.env.SEED_ADMIN_EMAIL || 'admin@smarttourism.test', adminHash, 'admin'],
      ['Amina Bello', 'Amina', 'amina@smarttourism.test', userHash, 'tourist'],
      ['Chinedu Okafor', 'Chinedu', 'chinedu@smarttourism.test', userHash, 'tourist'],
    ];
    for (const u of users) {
      await conn.execute(
        'INSERT INTO Users (full_name, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        u
      );
    }
    console.log(`Inserted ${users.length} demo users.`);

    const attractionsFile = path.join(__dirname, '../data/attractions.json');
    const attractions = JSON.parse(fs.readFileSync(attractionsFile, 'utf8'));
    let skipped = 0;
    for (const a of attractions) {
      if (a.latitude == null || a.longitude == null) {
        skipped += 1;
        continue; // run `npm run data:verify` first to fill missing coordinates
      }
      const catId = categoryId[a.category];
      if (!catId) throw new Error(`Unknown category "${a.category}" for ${a.name}`);
      await conn.execute(
        `INSERT INTO Attractions (name, category_id, description, latitude, longitude, address, image_url, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'curated', 'active')`,
        [a.name, catId, a.description, a.latitude, a.longitude, a.address || null, a.image_url || null]
      );
    }
    console.log(`Inserted ${attractions.length - skipped} attractions.`);
    if (skipped) {
      console.warn(`Skipped ${skipped} attractions with no coordinates yet. Run \`npm run data:verify\` (needs GOOGLE_MAPS_SERVER_KEY), then run db:setup again.`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
