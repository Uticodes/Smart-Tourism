# Discover Abuja

Crowdsourced Smart Tourism Recommendation and Navigation System for Unreported Local Attractions (Abuja, FCT).
Final-year BSc Computer Science project, Miva Open University.

- `server/` holds the Node.js + Express REST API and the MySQL schema.
- `client/` holds the React 18 + Vite single-page app.

The full feature plan is in the build plan document. Each feature (F0 to F13) is committed separately.

## What you need

- Node.js 18 or later (`node -v`)
- MySQL 8.0
- A Google Maps Platform **browser key** with **Maps JavaScript API** and **Routes API** enabled, restricted by HTTP referrer to `http://localhost:5173/*` (add the live address when deployed). Put it in `client/.env` as `VITE_GOOGLE_MAPS_BROWSER_KEY`. Without it the app still runs; maps show a notice.
- Optional: `VITE_GOOGLE_MAP_ID` (a JavaScript Map ID from Google Cloud → Map management). `DEMO_MAP_ID` is used if it is not set.
- Optional: a server key with Places API (New), only for the `data:verify` cross-check.

### Installing MySQL on macOS (Homebrew)

```bash
brew install mysql@8.0
brew services start mysql@8.0
echo 'export PATH="/opt/homebrew/opt/mysql@8.0/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Then create the database and a user for the app:

```bash
mysql -uroot <<'SQL'
CREATE DATABASE smart_tourism CHARACTER SET utf8mb4;
CREATE DATABASE smart_tourism_test CHARACTER SET utf8mb4;
CREATE USER 'tourism'@'localhost' IDENTIFIED BY 'choose_a_password';
GRANT ALL ON smart_tourism.* TO 'tourism'@'localhost';
GRANT ALL ON smart_tourism_test.* TO 'tourism'@'localhost';
FLUSH PRIVILEGES;
SQL
```

## First run

```bash
# 1. API
cd server
cp .env.example .env        # then edit DB_PASSWORD and JWT_SECRET
npm install
npm run db:setup            # creates the 8 tables and loads the seed data
npm run dev                 # http://localhost:4000/api/health

# 2. Web app (in a second terminal)
cd client
cp .env.example .env        # add VITE_GOOGLE_MAPS_BROWSER_KEY
npm install
npm run dev                 # http://localhost:5173
```

The home page should say "Server and database connected."

## Seed data: the 50 attractions

`server/data/attractions.json` lists 50 attractions across the FCT in five categories.

- **17** have coordinates confirmed from a named source: Wikipedia article infoboxes, or the NGA GeoNames gazetteer for forest reserves. The source is stored in each row's `coord_source`.
- **33** have names and addresses from FCTA and published Abuja guides, but no coordinates yet.

**Option A: OpenStreetMap (no key needed).** From your own computer (it needs internet access):

```bash
cd server
npm run data:fill-osm   # about 1 minute: OpenStreetMap allows one lookup per second
npm run db:setup        # reload with the filled coordinates
```

It writes `server/data/osm-report.csv`. Check every `FILLED` row to confirm the OSM name is the right place, then set `"verified": true` for that attraction in `attractions.json`. Rows marked `CHECK` disagree with OpenStreetMap by more than 300 m. Rows marked `NOT FOUND` need coordinates added by hand (right-click the place on openstreetmap.org and choose "Show address"). Map data © OpenStreetMap contributors.

**Option B: Google Places (cross-check, needs billing).** Add `GOOGLE_MAPS_SERVER_KEY` to `server/.env`, then:

```bash
cd server
npm run data:verify   # fills missing coordinates, checks the rest against Google Places
npm run db:setup      # reload with all 50
```

`data:verify` writes `server/data/verification-report.csv`. Any row marked `CHECK` is more than 300 m from Google's location, and any `FILLED` row should be checked to confirm Google matched the right place. Keep the report: it is evidence for Chapter 4.

`server/data/excluded.json` lists sites left out and why: outside the FCT (Zuma Rock and Gurara Falls, in Niger State), government offices that are not tourist sites, and places whose coordinates could not be confirmed.

## Demo accounts

Created by `npm run db:setup` (passwords come from `server/.env`):

| Role    | Email                     | Default password |
| ------- | ------------------------- | ---------------- |
| Admin   | admin@smarttourism.test   | Admin@12345      |
| Tourist | amina@smarttourism.test   | Tourist@12345    |
| Tourist | chinedu@smarttourism.test | Tourist@12345    |

Change these before the system is deployed online.

## Tests

```bash
cd server
npm test
```

Tests run against the separate `smart_tourism_test` database (created in the MySQL step above). They wipe and recreate it on each run, and refuse to run against any database whose name does not end in `_test`.

## Features built so far

| Feature | What it does                                                        | Requirements | Tests                 |
| ------- | ------------------------------------------------------------------- | ------------ | --------------------- |
| F0      | Project setup, 8-table schema, seed data                            | Section 3.6  | Haversine unit tests  |
| F1      | Create account, sign in, sign out (bcrypt + JWT in httpOnly cookie) | FR-01        | TC-AUTH-01 and 5 more |
| F2      | Choose preferred attraction categories                              | FR-02        | 3 tests               |
| F3      | Admin: add, edit and deactivate attractions with a map pin; manage categories | FR-09 | TC-ADM-01 and 4 more |
| F4      | Explore: search 1–50 km from your location or a chosen point, filter by category and rating, list and map | FR-03, FR-05 | TC-SEARCH-01 and 4 more; geo unit tests |
| F5      | Home page recommendations: score = 0.4 × category match + 0.3 × rating + 0.3 × proximity, list or map; logs which result was opened (for MRR) | FR-04 | TC-REC-01 and 6 more; scoring unit tests |
| F6      | Attraction details page with photos, description and map. **Get directions** shows the route inside the app on a Google map (driving or walking, step-by-step, live position, re-routing); **Open in Google Maps** hands over for spoken turn-by-turn | FR-05, FR-06, FR-07 | TC-NAV-01 and 2 more; directions unit tests |
| F7      | **Add a place**: report an unlisted site with photos (EXIF/GPS stripped), FCT boundary check, 150 m duplicate warning, 5 reports a day; **Your reports** with status and admin notes | FR-11, FR-12, FR-15 | TC-REP-01 to 03 and 6 more |
| F8      | **Community**: nearby unverified reports; confirm or flag (with a reason). 3 confirmations → under review; 3+ flags outnumbering confirmations → hidden | FR-13 | TC-REP-04 and 3 more; status-rule unit tests |
| F9      | **Admin review queue**: photos, map with the nearest existing place, community responses; approve (publishes with the Community-discovered badge, in one transaction), reject with a reason, or ask for more information | FR-14 | TC-REP-05 and 4 more |
| F10     | Reviews: 1–5 stars and an optional comment, one per visitor per place (edit or delete it); average recalculated in the same transaction; star breakdown on the details page | FR-08 | 5 tests |
| F11     | **Admin → Analytics**: searches per day, MRR and where opened results ranked, categories searched, report pipeline (approval rate, time to decision, near-duplicates), top-rated (Bayesian-weighted) and most-opened places; 7/30/90 days or all time, Abuja time | FR-10 | 6 tests |
| F12     | Security and privacy: helmet headers, CORS for the web app only, 100 KB body limit, API rate limit, production config checks, display names only in public, nightly rounding of search coordinates older than 30 days | Section 3.8.1–3.8.2 | 9 tests incl. an SQL-interpolation audit |
| F13     | Evaluation toolkit: Table 3.14 report, TC-PERF-01 with Postman/Newman, MRR and pilot export, SUS analysis with charts (see `server/evaluation/README.md`) | Section 3.8.3 | TC-PERF-01; 8 unit tests |

Sign in as the admin (see Demo accounts) and open **Admin** in the top bar to use F3, F9 and F11.

To try the reporting flow (F7 to F9): sign in as Amina and use **Add a place**; sign in as Chinedu and open **Community** to confirm it (people cannot confirm their own reports); then sign in as the admin and open **Admin → Review queue**. Report photos are saved in `server/uploads/reports/`, which git ignores.

## Evaluation (Chapter 4 and 5)

See `server/evaluation/README.md` for the user-testing session, the SUS form and these commands:

```bash
cd server
npm run test:report      # Table 3.14 results
npm run eval:perf        # TC-PERF-01: 50 calls per endpoint, mean must be under 2.0 s
npm run eval:export      # MRR lists, pilot reports and duplicate warnings, as CSV
npm run eval:analyse -- --sus path/to/sus.csv   # tables and charts for the report
```

## Privacy job

The API rounds search coordinates older than 30 days to two decimal places every night at 02:15 (Abuja time). Run it by hand with `npm run privacy:truncate`.

## Known limitation

In-app directions use the Routes library of the Maps JavaScript API. Google's terms require Routes results to be shown on a Google map, which is why every map in the app uses Google Maps. Spoken turn-by-turn guidance is only available in the Google Maps app, so the directions page links to it.

The FCT boundary check uses an approximate rectangle (about 8.3°N to 9.4°N, 6.7°E to 7.7°E). A rectangle includes some land just outside the FCT; for example, Zuma Rock in Niger State falls inside it. A polygon of the real FCT boundary would fix this.
