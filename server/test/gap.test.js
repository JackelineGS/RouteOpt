const test = require('node:test');
const assert = require('node:assert/strict');
const { computeGaps } = require('../src/gap');

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('con Held-Karp la referencia es el óptimo', () => {
  const g = computeGaps([
    { algorithm: 'nearest_neighbor', status: 'ok', cost_m: 110 },
    { algorithm: 'held_karp', status: 'ok', cost_m: 100 },
  ]);
  assert.equal(g.reference.type, 'optimal');
  assert.equal(g.best_algorithm, 'held_karp');
  assert.ok(close(g.results[0].gap_pct, 10));
  assert.ok(close(g.results[1].gap_pct, 0));
});

test('sin Held-Karp la referencia es la mejor solución conocida', () => {
  const g = computeGaps([
    { algorithm: 'nearest_neighbor', status: 'ok', cost_m: 120 },
    { algorithm: 'mst_dfs', status: 'ok', cost_m: 150 },
  ]);
  assert.equal(g.reference.type, 'best_known');
  assert.equal(g.best_algorithm, 'nearest_neighbor');
  assert.ok(close(g.results[1].gap_pct, 25));
});

test('timeout y skipped no cuentan para la referencia y quedan sin gap', () => {
  const g = computeGaps([
    { algorithm: 'held_karp', status: 'skipped' },
    { algorithm: 'mst_dfs', status: 'timeout', cost_m: null },
    { algorithm: 'nearest_neighbor', status: 'ok', cost_m: 200 },
  ]);
  assert.equal(g.reference.type, 'best_known');
  assert.equal(g.results[0].gap_pct, null);
  assert.equal(g.results[1].gap_pct, null);
  assert.ok(close(g.results[2].gap_pct, 0));
});

test('sin resultados válidos no hay referencia', () => {
  const g = computeGaps([{ algorithm: 'mst_dfs', status: 'timeout', cost_m: null }]);
  assert.equal(g.reference, null);
  assert.equal(g.best_algorithm, null);
});

test('un costo de referencia 0 no divide entre cero', () => {
  const g = computeGaps([{ algorithm: 'nearest_neighbor', status: 'ok', cost_m: 0 }]);
  assert.equal(g.results[0].gap_pct, 0);
});

test('con backtracking terminado la referencia también es el óptimo', () => {
  const g = computeGaps([
    { algorithm: 'nearest_neighbor', status: 'ok', cost_m: 120 },
    { algorithm: 'backtracking', status: 'ok', cost_m: 100 },
  ]);
  assert.equal(g.reference.type, 'optimal');
});
