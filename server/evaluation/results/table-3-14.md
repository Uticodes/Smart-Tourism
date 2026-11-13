# Table 3.14 results

Run on 2026-11-13 06:10 UTC with Jest + Supertest against the separate `smart_tourism_test` database.
112 of 112 automated tests passed in 14 suites.

| Test case | Feature | Input | Expected outcome | Tests | Result |
| --- | --- | --- | --- | --- | --- |
| TC-AUTH-01 | User registration | Unregistered email; valid details | Account created; bcrypt hash saved | 3 | Pass |
| TC-ADM-01 | Attraction management | Admin logged in; new attraction details | Attraction created and visible in search | 4 | Pass |
| TC-SEARCH-01 | Location radius | User GPS active; radiusKm = 10 | Returns only POIs within 10 km | 5 | Pass |
| TC-REC-01 | Scoring engine | Preferences set; category = Park | Matching-category POIs score higher | 4 | Pass |
| TC-NAV-01 | Navigation hand-off | POI selected; click "Get Directions" | External Google Maps route opens | 3 | Pass |
| TC-REP-01 | Report submission | User logged in; valid report with 2 photos | Report saved with status "pending" | 5 | Pass |
| TC-REP-02 | Boundary check | User logged in; coordinates in Lagos | Report rejected: outside FCT | 1 | Pass |
| TC-REP-03 | Duplicate detection | Attraction exists; report 80 m away | Duplicate warning shows the existing attraction | 3 | Pass |
| TC-REP-04 | Community corroboration | Pending report; 3 other users confirm | Status becomes under_review; reporter cannot confirm own report | 4 | Pass |
| TC-REP-05 | Approval and publication | Report under review; admin approves | New community attraction appears in search and recommendations | 6 | Pass |
| TC-PERF-01 | Response time | Seeded database; 50 API calls | Mean response time under 2.0 s (see perf-summary.md) | – | Run `npm run eval:perf` |

## Other automated tests

| Suite | Tests | Passed |
| --- | --- | --- |
| Security headers, CORS and request limits (Section 3.8.1) | 5 | 5 |
| SQL injection defence (Section 3.8.1) | 2 | 2 |
| Location privacy (Section 3.8.2) | 2 | 2 |
| Login, session and logout | 3 | 3 |
| FR-02 Category preferences | 3 | 3 |
| My reports | 1 | 1 |
| Reviews and ratings (FR-08) | 5 | 5 |
| Admin analytics (FR-10) | 6 | 6 |
| Selection logging for MRR | 3 | 3 |
| Category management | 1 | 1 |
|  | 7 | 7 |
| SUS scoring (Brooke, 1996) | 4 | 4 |
| MRR | 1 | 1 |
| t distribution and the one-sample test | 2 | 2 |
| CSV reader | 1 | 1 |
| insideFCT | 3 | 3 |
| boundingBox | 1 | 1 |
| withinRadius | 1 | 1 |
| recommendation score parts | 4 | 4 |
| score() | 2 | 2 |
| rank() | 2 | 2 |
| directionsUrl() | 3 | 3 |
| nearestWithin | 3 | 3 |
| report status rules | 4 | 4 |
| haversineKm | 5 | 5 |
