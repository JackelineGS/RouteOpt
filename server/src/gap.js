// Calcula el gap (%) de cada resultado respecto a la referencia:
//  - "optimal": si Held-Karp terminó, la mejor solución es el óptimo.
//  - "best_known": si no, la mejor solución entre los algoritmos ejecutados.

const EXACT = ['held_karp', 'backtracking'];

function computeGaps(results) {
  const ok = results.filter((r) => r.status === 'ok' && Number.isFinite(r.cost_m));

  if (ok.length === 0) {
    return {
      reference: null,
      best_algorithm: null,
      results: results.map((r) => ({ ...r, gap_pct: null })),
    };
  }

  const best = ok.reduce((a, b) => (b.cost_m < a.cost_m ? b : a));
  const exact = ok.some((r) => EXACT.includes(r.algorithm));
  const ref = best.cost_m;

  return {
    reference: {
      cost_m: ref,
      type: exact ? 'optimal' : 'best_known',
      algorithm: best.algorithm,
    },
    best_algorithm: best.algorithm,
    results: results.map((r) => ({
      ...r,
      gap_pct:
        r.status === 'ok' && Number.isFinite(r.cost_m)
          ? ref > 0
            ? ((r.cost_m - ref) / ref) * 100
            : 0
          : null,
    })),
  };
}

module.exports = { computeGaps };


