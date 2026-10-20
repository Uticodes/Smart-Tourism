const S = require('../../evaluation/lib/stats');
const { parse } = require('../../evaluation/lib/csv');

describe('SUS scoring (Brooke, 1996)', () => {
  test('all neutral answers score 50; the best possible pattern scores 100; the worst 0', () => {
    expect(S.susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50);
    expect(S.susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(S.susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
  });
  test('odd items count (answer − 1), even items (5 − answer), total × 2.5', () => {
    // (4-1)+(5-2)+(4-1)+(5-1)+(5-1)+(5-2)+(5-1)+(5-1)+(4-1)+(5-2) = 34 → 85
    expect(S.susScore([4, 2, 4, 1, 5, 2, 5, 1, 4, 2])).toBe(85);
  });
  test('incomplete or out-of-range responses are refused', () => {
    expect(() => S.susScore([4, 2, 4])).toThrow();
    expect(() => S.susScore([6, 2, 4, 1, 5, 2, 5, 1, 4, 2])).toThrow();
  });
  test('acceptability ranges (Bangor et al., 2008)', () => {
    expect(S.susAcceptability(72.5)).toBe('Acceptable');
    expect(S.susAcceptability(60)).toBe('Marginal');
    expect(S.susAcceptability(45)).toBe('Not acceptable');
  });
});

describe('MRR', () => {
  test('averages 1 ÷ rank', () => {
    expect(S.mrr([1, 2, 4])).toBeCloseTo((1 + 0.5 + 0.25) / 3, 10);
    expect(S.mrr([1, 1, 1])).toBe(1);
    expect(S.mrr([])).toBeNull();
  });
});

describe('t distribution and the one-sample test', () => {
  test('matches published critical values', () => {
    expect(S.tCritical95(29)).toBeCloseTo(2.045, 3);
    expect(S.tCritical95(9)).toBeCloseTo(2.262, 3);
    expect(S.tCdf(0, 10)).toBeCloseTo(0.5, 10);
    expect(S.tCdf(1.812, 10)).toBeCloseTo(0.95, 3);
  });
  test('one-sample t against 68', () => {
    const r = S.oneSampleT([70, 75, 80, 85, 90], 68);
    // mean 80, SD 7.906, SE 3.536, t = 3.394, df 4, one-sided p ≈ 0.0137
    expect(r.mean).toBe(80);
    expect(r.t).toBeCloseTo(3.394, 3);
    expect(r.p_one_sided).toBeCloseTo(0.0137, 3);
    expect(r.ci95[0]).toBeCloseTo(70.18, 1);
    expect(r.ci95[1]).toBeCloseTo(89.82, 1);
  });
});

describe('CSV reader', () => {
  test('handles quotes, commas inside quotes, CRLF and a byte-order mark (Google Forms exports)', () => {
    const { header, rows } = parse('﻿Timestamp,"I think that I would like to use this system frequently.",Note\r\n"2026/11/02 10:00:00",4,"good, fast"\r\n');
    expect(header[1]).toMatch(/frequently/);
    expect(rows[0].Note).toBe('good, fast');
  });
});
