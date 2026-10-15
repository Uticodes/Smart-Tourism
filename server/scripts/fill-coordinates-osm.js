/**
 * Fills missing attraction coordinates from OpenStreetMap (Nominatim) and cross-checks the rest.
 *   npm run data:fill-osm
 *
 * No API key needed. Follows the Nominatim usage policy: one request per second,
 * an identifying User-Agent, and results cached in the output so the script is not re-run often.
 *
 * For every attraction in data/attractions.json:
 *  - no coordinates yet  -> searches OpenStreetMap inside the FCT and fills them from the best match
 *                           (coord_source records the OSM object; verified stays false until you review it)
 *  - coordinates present -> measures the distance to the OSM match and flags anything over 300 m
 * Writes the updated data/attractions.json and data/osm-report.csv (evidence for Chapter 4).
 */
const fs = require('fs');
const path = require('path');
const { haversineKm } = require('../src/lib/haversine');

const DATA = path.join(__dirname, '../data/attractions.json');
const REPORT = path.join(__dirname, '../data/osm-report.csv');
const FLAG_METRES = 300;
const USER_AGENT = 'DiscoverAbuja/0.1 (Miva Open University final-year project; seed data check)';

// Approximate FCT bounding box (same as the app's boundary check). viewbox = left,top,right,bottom.
const VIEWBOX = '6.70,9.40,7.70,8.30';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'ng',
    viewbox: VIEWBOX,
    bounded: '1',
    addressdetails: '0',
  }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } });
  if (res.status === 429) throw new Error('OpenStreetMap asked us to slow down (429). Wait a few minutes and run again.');
  if (!res.ok) throw new Error(`Nominatim ${res.status}: ${await res.text()}`);
  const results = await res.json();
  return results[0] || null;
}

/** Tries a few phrasings, most specific first, one request per second. */
async function findPlace(a) {
  const district = a.address.split(',')[0];
  const queries = [`${a.name}, Abuja`, `${a.name}, ${district}`, a.name];
  for (const q of queries) {
    const hit = await nominatim(q);
    await sleep(1100);
    if (hit) return { hit, query: q };
  }
  return null;
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const attractions = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const header = ['name', 'our_lat', 'our_lng', 'osm_name', 'osm_type', 'osm_id', 'osm_category', 'osm_lat', 'osm_lng', 'distance_m', 'query_used', 'result'];
  const lines = [header.join(',')];
  let filled = 0, ok = 0, flagged = 0, missing = 0;

  for (const a of attractions) {
    const found = await findPlace(a);
    if (!found) {
      missing += 1;
      lines.push([a.name, a.latitude, a.longitude, '', '', '', '', '', '', '', '', 'NOT FOUND in OpenStreetMap - add coordinates manually'].map(csv).join(','));
      console.log(`?  ${a.name}: not found`);
      continue;
    }
    const { hit, query } = found;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    let distance = '';
    let result;

    if (a.latitude == null) {
      a.latitude = Number(lat.toFixed(6));
      a.longitude = Number(lng.toFixed(6));
      a.coord_source = `OpenStreetMap (Nominatim), matched "${hit.name || hit.display_name}" (${hit.osm_type}/${hit.osm_id}) on ${today}`;
      a.verified = false; // set to true after you confirm the match in osm-report.csv
      filled += 1;
      result = 'FILLED - confirm the OSM name matches this attraction';
    } else {
      distance = Math.round(haversineKm(a.latitude, a.longitude, lat, lng) * 1000);
      if (distance <= FLAG_METRES) { ok += 1; result = 'OK'; }
      else { flagged += 1; result = `CHECK - ${distance} m from the OSM location`; }
    }

    lines.push([a.name, a.latitude, a.longitude, hit.name || hit.display_name, hit.osm_type, hit.osm_id, `${hit.category}/${hit.type}`, lat, lng, distance, query, result].map(csv).join(','));
    console.log(`${result.startsWith('CHECK') ? '!!' : 'ok'} ${a.name}: ${result}`);
  }

  fs.writeFileSync(DATA, JSON.stringify(attractions, null, 2) + '\n');
  fs.writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log(`\nFilled ${filled}, confirmed ${ok}, flagged ${flagged}, not found ${missing}.`);
  console.log(`Updated data/attractions.json and wrote data/osm-report.csv`);
  console.log('Map data © OpenStreetMap contributors (ODbL).');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
