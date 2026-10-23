# TC-PERF-01 – response time

**Result: PASS.** Mean response time was under the 2.0 s target for every endpoint (Section 3.8.3).

| Endpoint | Calls | Mean (ms) | SD | Median | 95th percentile | Min | Max | Target met |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Location search | 50 | 4 | 3 | 4 | 6 | 2 | 24 | Yes |
| Recommendations | 50 | 4 | 1 | 4 | 5 | 2 | 6 | Yes |
| Report submission | 50 | 85 | 4 | 84 | 91 | 80 | 104 | Yes |
| **All calls** | 150 | 31 | 38 | 4 | 87 | 2 | 104 | Yes |

## Test conditions

- 2026-10-22 12:43 UTC; 50 iterations of the Postman collection run with Newman 6.2.3.
- API and MySQL 8.0.46 on the same machine: Apple M3 Pro (12 cores), 18 GB RAM, Darwin 27.0.0; Node v26.5.0.
- Seeded database with 50 active attractions; requests signed in as a tourist with two saved interests.
- Each report carried one 1.9 MB JPEG photo, re-encoded by the server (EXIF removed).
- 0 non-2xx responses; 0 failed Postman assertions. Total run time 6.3 s.
- Times are measured by Newman from request start to the last byte of the response. They do not include internet latency, which a deployed server adds.
