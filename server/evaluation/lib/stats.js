/** Small statistics helpers for the Chapter 4/5 evaluation. No dependencies, so the numbers are easy to check by hand. */

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * System Usability Scale score for one participant (Brooke, 1996).
 * answers: ten numbers from 1 (strongly disagree) to 5 (strongly agree), in questionnaire order.
 * Odd items are positive (score − 1), even items are negative (5 − score); the sum × 2.5 gives 0–100.
 */
function susScore(answers) {
  if (answers.length !== 10 || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) {
    throw new Error('A SUS response needs ten answers, each a whole number from 1 to 5.');
  }
  const sum = answers.reduce((s, a, i) => s + (i % 2 === 0 ? a - 1 : 5 - a), 0);
  return sum * 2.5;
}

/** Bangor, Kortum & Miller (2008) acceptability ranges. */
function susAcceptability(score) {
  if (score >= 70) return 'Acceptable';
  if (score >= 50) return 'Marginal';
  return 'Not acceptable';
}

/** Mean Reciprocal Rank: average of 1 ÷ rank over lists where the user chose something. */
function mrr(ranks) {
  const r = ranks.filter((x) => Number.isFinite(x) && x >= 1);
  return r.length ? mean(r.map((x) => 1 / x)) : null;
}

// ---- Student's t distribution (for confidence intervals and the one-sample test against 68)

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularised incomplete beta I_x(a, b), by continued fraction (Numerical Recipes, betacf). */
function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx, aa, bb) => {
    let c = 1, d = 1 - ((aa + bb) * xx) / (aa + 1);
    d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let num = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + num * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
      c = 1 + num / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; h *= d * c;
      num = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + num * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
      c = 1 + num / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (front * cf(x, a, b)) / a : 1 - (front * cf(1 - x, b, a)) / b;
}

/** P(T ≤ t) for Student's t with df degrees of freedom. */
function tCdf(t, df) {
  const ib = incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - ib / 2 : ib / 2;
}

/** Critical t for a two-sided 95% interval, found by bisection on tCdf. */
function tCritical95(df) {
  let lo = 0, hi = 50;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < 0.975) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * One-sample t-test of H1: population mean > mu (e.g. SUS above the benchmark of 68).
 * Returns t, df, one-sided p and the 95% confidence interval of the mean.
 */
function oneSampleT(xs, mu) {
  const n = xs.length;
  const m = mean(xs);
  const s = sd(xs);
  const se = s / Math.sqrt(n);
  const df = n - 1;
  const t = se === 0 ? (m > mu ? Infinity : m < mu ? -Infinity : 0) : (m - mu) / se;
  const p = Number.isFinite(t) ? 1 - tCdf(t, df) : t > 0 ? 0 : 1;
  const half = df > 0 ? tCritical95(df) * se : 0;
  return { n, mean: m, sd: s, t, df, p_one_sided: p, ci95: [m - half, m + half] };
}

module.exports = { mean, sd, median, susScore, susAcceptability, mrr, tCdf, tCritical95, oneSampleT };
