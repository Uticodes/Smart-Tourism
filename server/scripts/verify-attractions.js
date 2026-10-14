/**
 * Verifies and completes the seed attraction coordinates using Google Places (New) Text Search.
 *   npm run data:verify
 *
 * For every attraction in data/attractions.json it searches "<name>, <address>" near Abuja:
 *  - no coordinates yet  -> fills them from the top match (verified = true, source recorded)
 *  - coordinates present -> measures the distance to Google's location and flags anything over 300 m
 * Writes the updated data/attractions.json and data/verification-report.csv (evidence for Chapter 4).
 * Requires GOOGLE_MAPS_SERVER_KEY in .env with "Places API (New)" enabled.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { haversineKm } = require('../src/lib/haversine');

const KEY = process.env.GOOGLE_MAPS_SERVER_KEY;
const DATA = path.join(__dirname, '../data/attractions.json');
const REPORT = path.join(__dirname, '../data/verification-report.csv');
const ABUJA = { latitude: 9.0579, longitude: 7.4951 };
const FLAG_METRES = 300;

async function searchPlace(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: ABUJA, radius: 50000 } },
      maxResultCount: 1,
    }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.places?.[0] || null;
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  if (!KEY) {
    console.error('Set GOOGLE_MAPS_SERVER_KEY in server/.env first.');
    process.exit(1);
  }
  const attractions = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const lines = [['name', 'our_lat', 'our_lng', 'google_name', 'google_address', 'google_lat', 'google_lng', 'distance_m', 'result'].join(',')];

  for (const a of attractions) {
    const place = await searchPlace(`${a.name}, ${a.address}`);
    if (!place) {
      lines.push([a.name, a.latitude, a.longitude, '', '', '', '', '', 'NOT FOUND - check manually'].map(csv).join(','));
      console.log(`?  ${a.name}: not found`);
      continue;
    }
    const g = place.location;
    let result;
    let distance = '';
    if (a.latitude == null) {
      a.latitude = Number(g.latitude.toFixed(6));
      a.longitude = Number(g.longitude.toFixed(6));
      a.coord_source = `Google Places, matched "${place.displayName?.text}" on ${today}`;
      a.verified = true;
      result = 'FILLED from Google Places - confirm the match name is right';
    } else {
      distance = Math.round(haversineKm(a.latitude, a.longitude, g.latitude, g.longitude) * 1000);
      result = distance <= FLAG_METRES ? 'OK' : `CHECK - ${distance} m from Google's location`;
    }
    lines.push([a.name, a.latitude, a.longitude, place.displayName?.text, place.formattedAddress, g.latitude, g.longitude, distance, result].map(csv).join(','));
    console.log(`${result.startsWith('OK') || result.startsWith('FILLED') ? 'ok' : '!!'} ${a.name}: ${result}`);
  }

  fs.writeFileSync(DATA, JSON.stringify(attractions, null, 2) + '\n');
  fs.writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log(`\nUpdated ${path.relative(process.cwd(), DATA)} and wrote ${path.relative(process.cwd(), REPORT)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
