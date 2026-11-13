# Evaluation results

Generated 2026-11-12 22:18 UTC by `npm run eval:analyse`.

## 1. Response time (TC-PERF-01)

Target: mean under 2 s per endpoint. **Result: met.**

| Endpoint | Calls | Mean (ms) | SD | Median | 95th percentile | Max |
| --- | --- | --- | --- | --- | --- | --- |
| Location search | 50 | 4 | 3 | 4 | 6 | 24 |
| Recommendations | 50 | 4 | 1 | 4 | 5 | 6 |
| Report submission | 50 | 85 | 4 | 84 | 91 | 104 |

Conditions: 50 Newman iterations; Apple M3 Pro (12 cores), 18 GB RAM, Darwin 27.0.0; MySQL 8.0.46; 50 attractions; 1.9 MB photo per report.

*Figure: charts/response-time.png*

## 2. Recommendation accuracy (MRR)

MRR = (1 ÷ |Q|) × Σ 1 ÷ rank_i, over the |Q| recommendation lists in which the participant opened a place (Section 3.8.3).

| Measure | Value |
| --- | --- |
| Recommendation lists shown | 79 |
| Lists where a place was opened (\|Q\|) | 18 (22.8%) |
| **Mean Reciprocal Rank** | **0.432** |
| Opened the 1st result (Hit@1) | 27.8% |
| Opened one of the top 3 (Hit@3) | 44.4% |
| MRR, signed-in (personalised) | 0.411 (n = 16) |
| MRR, guests (rating and distance only) | 0.600 (n = 2) |

*Figure: charts/mrr-rank-distribution.png*

## 3. Crowdsourcing pilot

| Measure (Section 3.8.3) | Value |
| --- | --- |
| Reports submitted | 6 |
| Duplicates caught automatically (150 m warning) | 1 |
| Sent anyway as a different place | 0 |
| Reached 3 community confirmations | 2 |
| Hidden by community flags | 1 |
| Approved | 3 |
| Not approved | 2 |
| Still open at export | 1 |
| **Approval rate (approved ÷ submitted)** | **50%** |
| Approval rate of decided reports | 60% |
| **Mean time to decision** | **3.2 h** (median 2.0 h) |

*Figure: charts/pilot-pipeline.png*

## 4. Usability (System Usability Scale)

N = 15 complete responses. Scored per Brooke (1996); benchmark 68 (Bangor, Kortum & Miller, 2008).

| Measure | Value |
| --- | --- |
| **Mean SUS score** | **82.0** (SD 18.2) |
| 95% confidence interval | 71.9 to 92.1 |
| Median (min–max) | 90.0 (40–100) |
| Participants above 68 | 13 of 15 (86.7%) |
| One-sample t-test, mean > 68 | t(14) = 2.98, p = .005 (one-sided) |
| Acceptable (Bangor et al., 2008) | 13 |
| Marginal (Bangor et al., 2008) | 0 |
| Not acceptable (Bangor et al., 2008) | 2 |

| Group | n | Mean | SD |
| --- | --- | --- | --- |
| staff | 4 | 80.0 | 27.4 |
| student | 4 | 69.4 | 18.5 |
| visitor | 3 | 90.8 | 10.1 |
| resident | 4 | 90.0 | 2.0 |

| Item | Mean answer (1–5) |
| --- | --- |
| Q1 (positive) | 4.20 |
| Q2 (negative) | 1.93 |
| Q3 (positive) | 4.20 |
| Q4 (negative) | 1.93 |
| Q5 (positive) | 4.53 |
| Q6 (negative) | 1.47 |
| Q7 (positive) | 4.13 |
| Q8 (negative) | 1.33 |
| Q9 (positive) | 4.20 |
| Q10 (negative) | 1.80 |

*Figure: charts/sus-distribution.png*
