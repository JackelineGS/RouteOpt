const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('../src/config');
const { runEngine } = require('../src/engine');
const { computeGaps } = require('../src/gap');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REPEAT_BELOW_MS = 500;
const ORDER = ['nearest_neighbor', 'mst_dfs', 'held_karp', 'backtracking'];
const SHORT = { nearest_neighbor: 'NN', mst_dfs: 'MST', held_karp: 'HK', backtracking: 'BT' };
const COLUMNS = [
  'n', 'seed', 'instance_id', 'algorithm', 'status', 'cost_m', 'gap_pct',
  'reference_type', 'reference_cost_m', 'time_ms_median', 'time_ms_min', 'time_ms_max',
  'reps', 'operations', 'extra_memory_kb', 'limit_ms',
];

function parseArgs(argv) {
  const opts = {
    sizes: [5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 50],
    seeds: 10,
    reps: 5,
    limit: 10000,
    out: null,
  };
  for (const arg of argv) {
    const m = /^--([a-z]+)=(.+)$/.exec(arg);
    if (!m) throw new Error(`Argumento no reconocido: ${arg}`);
    const [, key, value] = m;
    if (key === 'sizes') opts.sizes = value.split(',').map(Number);
    else if (key === 'seeds') opts.seeds = Number(value);
    else if (key === 'reps') opts.reps = Number(value);
    else if (key === 'limit') opts.limit = Number(value);
    else if (key === 'out') opts.out = value;
    else throw new Error(`Opción desconocida: --${key}`);
  }
  if (!opts.sizes.every((n) => Number.isInteger(n) && n >= 2 && n <= 5000)) {
    throw new Error('--sizes debe ser una lista de enteros entre 2 y 5000');
  }
  if (!Number.isInteger(opts.seeds) || opts.seeds < 1) throw new Error('--seeds debe ser un entero >= 1');
  if (!Number.isInteger(opts.reps) || opts.reps < 1) throw new Error('--reps debe ser un entero >= 1');
  if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > config.MAX_TIME_LIMIT_MS) {
    throw new Error(`--limit debe ser un entero entre 1 y ${config.MAX_TIME_LIMIT_MS} (ms)`);
  }
  return opts;
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function solveRun(instance, algorithm, limitMs) {
  return runEngine(
    { mode: 'solve', algorithm, instance, options: { time_limit_ms: limitMs } },
    { timeoutMs: limitMs + config.KILL_MARGIN_MS }
  );
}

// Una ejecución; si es rápida, se repite y se guarda la mediana del tiempo.
async function measure(instance, algorithm, opts) {
  const first = await solveRun(instance, algorithm, opts.limit);
  if (first.status === 'error') {
    if (first.error.code === 'INSTANCE_TOO_LARGE') return { algorithm, status: 'skipped' };
    throw new Error(`${algorithm}: ${first.error.code} - ${first.error.message}`);
  }

  const runs = [first];
  if (first.status === 'ok' && first.metrics.time_ms < REPEAT_BELOW_MS) {
    for (let i = 1; i < opts.reps; i++) {
      const r = await solveRun(instance, algorithm, opts.limit);
      if (r.status === 'timeout') break;
      if (r.status !== 'ok' || Math.abs(r.cost_m - first.cost_m) > 1e-6) {
        throw new Error(`${algorithm}: resultados distintos entre repeticiones (no determinista o falló)`);
      }
      runs.push(r);
    }
  }

  const times = runs.map((r) => r.metrics.time_ms);
  const extra = runs.map((r) =>
    Math.max(0, r.metrics.peak_memory_kb - r.metrics.baseline_memory_kb)
  );
  return {
    ...first,
    time_ms_median: median(times),
    time_ms_min: Math.min(...times),
    time_ms_max: Math.max(...times),
    reps: runs.length,
    operations: first.metrics.operations,
    extra_memory_kb: median(extra),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..*/, '')
    .replace('T', '-');
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.join(REPO_ROOT, 'data', 'results', `benchmark-${stamp}.csv`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const ping = await runEngine({ mode: 'ping' }, { timeoutMs: 5000 });
  const cpus = os.cpus();
  const meta = {
    date: new Date().toISOString(),
    engine: ping,
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    cpu: cpus[0] ? cpus[0].model : 'desconocido',
    cpu_threads: cpus.length,
    ram_gb: Math.round((os.totalmem() / 1e9) * 10) / 10,
    options: opts,
    repeat_below_ms: REPEAT_BELOW_MS,
  };
  fs.writeFileSync(`${outPath}.meta.json`, JSON.stringify(meta, null, 2));

  // Calentamiento: una ejecución descartada para no medir arranques en frío.
  const warm = await runEngine({ mode: 'generate', n: 20, seed: 1 }, { timeoutMs: 30000 });
  if (warm.status !== 'ok') throw new Error('No se pudo generar la instancia de calentamiento');
  await solveRun(warm.instance, 'nearest_neighbor', 1000);

  fs.writeFileSync(outPath, COLUMNS.join(',') + '\n');
  console.log(
    `${opts.sizes.length} tamaños x ${opts.seeds} semillas x ${ORDER.length} algoritmos, ` +
      `límite ${opts.limit} ms, hasta ${opts.reps} repeticiones.`
  );
  console.log(`Salida: ${outPath}`);

  const t0 = Date.now();
  for (const n of opts.sizes) {
    for (let seed = 1; seed <= opts.seeds; seed++) {
      const gen = await runEngine({ mode: 'generate', n, seed }, { timeoutMs: 30000 });
      if (gen.status !== 'ok') throw new Error(`generate falló para n=${n}, semilla=${seed}`);
      const instance = gen.instance;

      const measured = [];
      for (const algorithm of ORDER) measured.push(await measure(instance, algorithm, opts));

      const gaps = computeGaps(measured);
      const ref = gaps.reference;
      const lines = gaps.results.map((r) => {
        const ok = r.status === 'ok';
        const timed = ok || r.status === 'timeout';
        return [
          n, seed, instance.id, r.algorithm, r.status,
          ok ? r.cost_m.toFixed(3) : '',
          r.gap_pct == null ? '' : r.gap_pct.toFixed(4),
          ref ? ref.type : '',
          ref ? ref.cost_m.toFixed(3) : '',
          timed ? r.time_ms_median.toFixed(4) : '',
          timed ? r.time_ms_min.toFixed(4) : '',
          timed ? r.time_ms_max.toFixed(4) : '',
          timed ? r.reps : '',
          timed ? r.operations : '',
          timed ? Math.round(r.extra_memory_kb) : '',
          opts.limit,
        ].join(',');
      });
      fs.appendFileSync(outPath, lines.join('\n') + '\n');

      const resumen = gaps.results
        .map((r) =>
          r.status === 'ok'
            ? `${SHORT[r.algorithm]} ${r.time_ms_median.toFixed(1)}ms`
            : `${SHORT[r.algorithm]} ${r.status}`
        )
        .join(' | ');
      const sec = Math.round((Date.now() - t0) / 1000);
      console.log(`[${sec}s] n=${n} semilla=${seed}: ${resumen}`);
    }
  }
  console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s.`);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
