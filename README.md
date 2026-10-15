# Discover Abuja

Crowdsourced Smart Tourism Recommendation and Navigation System for Unreported Local Attractions (Abuja, FCT). Final-year BSc Computer Science project, Miva Open University.

- `server/` holds the Node.js + Express REST API and the MySQL schema.
- `client/` holds the React 18 + Vite single-page app.

The full feature plan is in the build plan document. Each feature (F0 to F13) is committed separately.

## What you need

- Node.js 18 or later (`node -v`)
- MySQL 8.0
- For maps: a Google Cloud project with billing enabled and these APIs switched on:
  - Maps JavaScript API (browser key)
  - Places API (New) (server key, used to verify attraction coordinates)

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
cp .env.example .env        # add VITE_GOOGLE_MAPS_BROWSER_KEY when you have it
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

`server/data/excluded-outside-fct.json` lists well-known sites left out because they are outside the FCT (Zuma Rock and Gurara Falls are in Niger State).

## Demo accounts

Created by `npm run db:setup` (passwords come from `server/.env`):

| Role | Email | Default password |
| --- | --- | --- |
| Admin | admin@smarttourism.test | Admin@12345 |
| Tourist | amina@smarttourism.test | Tourist@12345 |
| Tourist | chinedu@smarttourism.test | Tourist@12345 |

Change these before the system is deployed online.

## Tests

```bash
cd server
npm test
```

## Known limitation

The FCT boundary check uses an approximate rectangle (about 8.3°N to 9.4°N, 6.7°E to 7.7°E). A rectangle includes some land just outside the FCT; for example, Zuma Rock in Niger State falls inside it. A polygon of the real FCT boundary would fix this.
