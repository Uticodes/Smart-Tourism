# Evaluation toolkit (Section 3.8.3)

Everything needed to produce the Chapter 4 results and the Chapter 5 evaluation. All commands run from `server/`.

| Measure (Chapter 3) | How it is collected | Command | Output in `evaluation/results/` |
| --- | --- | --- | --- |
| Functional tests, Table 3.14 | Jest + Supertest on the test database | `npm run test:report` | `table-3-14.md`, `test-results.csv` |
| TC-PERF-01 response time (< 2.0 s) | Postman collection run 50 times by Newman | `npm run eval:perf` | `perf-summary.md`, `perf-timings.csv` |
| Recommendation accuracy (MRR) | The app logs the rank of the place opened from each recommendation list | `npm run eval:export` | `mrr-lists.csv` |
| Crowdsourcing pilot | Site reports and the duplicate-warning log | `npm run eval:export` | `pilot-reports.csv`, `duplicate-warnings.csv` |
| Usability (SUS, N = 30) | Google Form, exported to CSV | (form) | your CSV |
| **All of the above → numbers, tables, figures** | | `npm run eval:analyse -- --sus <file>` | `evaluation-results.md`, `charts/*.png` |

`npm test` and `npm run eval:perf` only touch the separate `smart_tourism_test` database. `npm run eval:export` reads the database in `.env` (your real one) and never changes it.

## 1. Before the user-testing session

1. Reset the real database so the logs contain only the session: `npm run db:setup` (this deletes all users, reports and reviews).
2. Write down the dates of the session (Abuja time). You will export only that window.
3. Make the SUS Google Form (below) and print or share the task sheet.

### Suggested scenario tasks (about 15 minutes per participant)

1. Create an account and choose two kinds of places you like.
2. On the home page, open the recommended place you would most like to visit. (This records the rank for MRR, so ask participants to choose genuinely.)
3. Find historical sites within 5 km of Abuja city centre on Explore, then open one and press **Get directions**.
4. Leave a review on a place you have visited.
5. **Reporting task:** add a place you know that is not on the map (FCT residents and indigenes), with at least one photo.
6. Open **Community** and confirm or flag someone else's report.

### The SUS form

Create a Google Form with:

- A consent statement first (Section 3.8.2): what the study is, that answers are anonymous, and that they can stop at any time. One required checkbox: "I agree to take part."
- **Participant ID** (short answer, e.g. P01) and **Group** (multiple choice: student, staff, visitor). Do not ask for names or emails.
- The ten SUS statements below, in this order, each as a required **Linear scale 1 to 5** with labels *1 = Strongly disagree* and *5 = Strongly agree*. Keep the wording exactly as written (Brooke, 1996); do not reorder or reverse items.

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

To export: Responses → **Link to Sheets** → in the sheet, File → Download → **Comma-separated values (.csv)**.

The analysis finds the ten answer columns automatically (the first ten columns whose answers are all 1–5). If you collect answers on paper instead, type them into `sus-responses.template.csv` (save it as `sus-responses.csv`).

## 2. After the session

```bash
cd server
npm run test:report                                     # Table 3.14
npm run eval:perf                                       # TC-PERF-01 (about 20 seconds)
npm run eval:export -- --from 2026-11-02 --to 2026-11-06   # your session dates
npm run eval:analyse -- --sus ~/Downloads/SUS.csv
```

Open `evaluation/results/evaluation-results.md`. It has the tables for Chapter 4 and the Chapter 5 evaluation, and names a figure for each: `charts/response-time.png`, `charts/mrr-rank-distribution.png`, `charts/pilot-pipeline.png`, `charts/sus-distribution.png`. The PNGs are drawn at twice screen resolution, so they stay sharp in Word.

## How each number is calculated

- **Response time:** mean, SD, median, 95th percentile, min and max of Newman's response times per endpoint (request start to last byte). The test runs on one machine, so it excludes internet latency; say so in Chapter 4.
- **MRR** = (1 ÷ |Q|) × Σ 1 ÷ rank_i over the recommendation lists where the participant opened a place. Lists where nothing was opened are reported as the selection rate. Hit@1 and Hit@3 are the share of opened places that were 1st, or in the top 3. MRR is also split into signed-in (personalised) and guest lists.
- **Pilot:** approval rate = approved ÷ submitted (as defined in Section 3.8.3), also given as approved ÷ decided; duplicates caught = duplicate warnings shown (each stopped a report before it was saved); time to decision = hours from submission to approval or rejection.
- **SUS** (Brooke, 1996): odd items score (answer − 1), even items (5 − answer); the sum × 2.5 gives 0–100. Reported with SD, 95% confidence interval (t distribution), the share above 68, Bangor et al.'s (2008) acceptability ranges, and a one-sided one-sample t-test of mean > 68.

The formulas are in `evaluation/lib/stats.js` and are unit-tested against published values in `tests/unit/evaluation.test.js`.
