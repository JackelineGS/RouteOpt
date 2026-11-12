const fs = require('fs');
const path = require('path');

const ORDER = ['nearest_neighbor', 'mst_dfs', 'held_karp', 'backtracking'];
const LABEL = {
  nearest_neighbor: 'Nearest Neighbor',
  mst_dfs: 'MST + DFS',
  held_karp: 'Held-Karp',
  backtracking: 'Backtracking (B&B)',
};

function latestCsv() {
  const dir = path.resolve(__dirname, '..', '..', 'data', 'results');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /^benchmark-.*\.csv$/.test(f)).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

const file = process.argv[2] ? path.resolve(process.argv[2]) : latestCsv();
if (!file || !fs.existsSync(file)) {
  console.error('Uso: node scripts/summarize.js [archivo.csv]  (sin argumento usa el más reciente)');
  process.exit(1);
}

const num = (v) => (v === '' || v === undefined ? null : Number(v));
const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
const header = lines[0].split(',');
const rows = lines.slice(1).map((line) => {
  const cells = line.split(',');
  const r = {};
  header.forEach((h, i) => { r[h] = cells[i]; });
  return {
    n: Number(r.n),
    seed: Number(r.seed),
    algorithm: r.algorithm,
    status: r.status,
    cost_m: num(r.cost_m),
    gap_pct: num(r.gap_pct),
    reference_type: r.reference_type,
    time_ms: num(r.time_ms_median),
    operations: num(r.operations),
    extra_memory_kb: num(r.extra_memory_kb),
  };
});
if (rows.length === 0) {
  console.error('El CSV no tiene filas de datos.');
  process.exit(1);
}

const median = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const maxOf = (v) => (v.length ? Math.max(...v) : null);
const vals = (rs, key) => rs.map((r) => r[key]).filter((v) => v != null);

const fmtMs = (v) => (v == null ? '—' : v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(3));
const fmtKm = (m) => (m == null ? '—' : (m / 1000).toFixed(2));
const fmtPct = (v) => (v == null ? '—' : v.toFixed(2));
const fmtInt = (v) => (v == null ? '—' : Math.round(v).toLocaleString('es-PE'));

const ns = [...new Set(rows.map((r) => r.n))].sort((a, b) => a - b);
const rowsOf = (n, a) => rows.filter((r) => r.n === n && (a === undefined || r.algorithm === a));

function statusText(rs) {
  const c = { ok: 0, timeout: 0, skipped: 0 };
  rs.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
  if (c.skipped === rs.length) return 'No admite este tamaño';
  const parts = [`${c.ok}/${rs.length} resueltas`];
  if (c.timeout) parts.push(`${c.timeout} tiempo agotado`);
  return parts.join(', ');
}

function refText(rs) {
  const types = new Set(rs.map((r) => r.reference_type).filter(Boolean));
  if (types.size === 0) return '—';
  if (types.size > 1) return 'mixta';
  return types.has('optimal') ? 'óptimo' : 'mejor conocida';
}

// Tabla 1: todo por tamaño y algoritmo.
const t1 = [
  '| N | Algoritmo | Estado | Costo mediano (km) | Gap medio (%) | Gap máx. (%) | Tiempo mediano (ms) | Operaciones (mediana) | Memoria extra (KB) | Referencia del gap |',
  '|---|---|---|---|---|---|---|---|---|---|',
];
for (const n of ns) {
  const ref = refText(rowsOf(n));
  for (const a of ORDER) {
    const rs = rowsOf(n, a);
    if (!rs.length) continue;
    const ok = rs.filter((r) => r.status === 'ok');
    t1.push(
      `| ${n} | ${LABEL[a]} | ${statusText(rs)} | ${fmtKm(median(vals(ok, 'cost_m')))} | ` +
        `${fmtPct(mean(vals(ok, 'gap_pct')))} | ${fmtPct(maxOf(vals(ok, 'gap_pct')))} | ` +
        `${fmtMs(median(vals(ok, 'time_ms')))} | ${fmtInt(median(vals(ok, 'operations')))} | ` +
        `${fmtInt(median(vals(ok, 'extra_memory_kb')))} | ${ref} |`
    );
  }
}

// Tabla 2: viabilidad del backtracking.
const t2 = [
  '| N | Resueltas | Tiempo mediano (ms) | Tiempo máx. (ms) | Nodos explorados (mediana) |',
  '|---|---|---|---|---|',
];
const btSizes = ns.filter((n) => rowsOf(n, 'backtracking').some((r) => r.status !== 'skipped'));
for (const n of btSizes) {
  const rs = rowsOf(n, 'backtracking');
  const ok = rs.filter((r) => r.status === 'ok');
  t2.push(
    `| ${n} | ${ok.length}/${rs.length} | ${fmtMs(median(vals(ok, 'time_ms')))} | ` +
      `${fmtMs(maxOf(vals(ok, 'time_ms')))} | ${fmtInt(median(vals(ok, 'operations')))} |`
  );
}
const firstFail = btSizes.find((n) => rowsOf(n, 'backtracking').some((r) => r.status === 'timeout'));
let verdict;
if (btSizes.length === 0) {
  verdict = 'No hay datos de backtracking.';
} else if (firstFail === undefined) {
  verdict = `Backtracking resolvió todas las instancias hasta N=${Math.max(...btSizes)}; no se agotó el tiempo en ningún tamaño probado.`;
} else {
  const before = btSizes.filter(
    (n) => n < firstFail && rowsOf(n, 'backtracking').every((r) => r.status === 'ok')
  );
  verdict =
    `Primer tamaño con tiempo agotado: N=${firstFail}. ` +
    (before.length
      ? `Último tamaño anterior resuelto en todas las semillas: N=${Math.max(...before)}.`
      : 'Ningún tamaño anterior se resolvió en todas las semillas.');
}

// Tabla 3: Nearest Neighbor frente a MST + DFS.
const t3 = [
  '| N | Tiempo MST+DFS ÷ Nearest Neighbor (mediana) | Menor costo: NN / MST+DFS / empate |',
  '|---|---|---|',
];
for (const n of ns) {
  const nn = rowsOf(n, 'nearest_neighbor');
  const mst = rowsOf(n, 'mst_dfs');
  const ratios = [];
  const wins = [0, 0, 0];
  for (const a of nn) {
    const b = mst.find((r) => r.seed === a.seed);
    if (!b || a.status !== 'ok' || b.status !== 'ok') continue;
    if (a.time_ms > 0) ratios.push(b.time_ms / a.time_ms);
    if (Math.abs(a.cost_m - b.cost_m) <= 1e-6) wins[2]++;
    else if (a.cost_m < b.cost_m) wins[0]++;
    else wins[1]++;
  }
  t3.push(`| ${n} | ${ratios.length ? median(ratios).toFixed(1) + '×' : '—'} | ${wins.join(' / ')} |`);
}

const metaFile = `${file}.meta.json`;
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
const out = ['# Resultados del benchmark', ''];
if (meta) {
  out.push(
    '## Condiciones del experimento',
    '',
    `- Fecha: ${meta.date}`,
    `- Equipo: ${meta.cpu} (${meta.cpu_threads} hilos), ${meta.ram_gb} GB de RAM, ${meta.os}`,
    `- Node ${meta.node}; motor ${meta.engine.engine} ${meta.engine.version}`,
    `- Límite por algoritmo: ${meta.options.limit / 1000} s. Semillas por tamaño: ${meta.options.seeds}. ` +
      `Repeticiones: hasta ${meta.options.reps}, solo si la primera ejecución dura menos de ${meta.repeat_below_ms} ms.`,
    `- Tamaños: ${meta.options.sizes.join(', ')}`,
    ''
  );
}
out.push(
  '## Tabla 1. Comparación por tamaño y algoritmo', '', ...t1, '',
  'Costo, tiempo, operaciones y memoria: mediana sobre las semillas que ese algoritmo resolvió en ese tamaño. ' +
    'Gap medio y máximo: sobre esas mismas semillas. "Referencia": óptimo si terminó un algoritmo exacto ' +
    '(Held-Karp o backtracking); mejor conocida si no, y entonces el gap no es respecto al óptimo. ' +
    'La memoria extra es el pico menos la memoria base; en instancias pequeñas es ruido del sistema (decenas de KB).',
  '',
  '## Tabla 2. Viabilidad del backtracking', '', ...t2, '',
  verdict,
  'Tiempo y nodos se calculan solo sobre las semillas resueltas; las que agotaron el tiempo no entran.',
  '',
  '## Tabla 3. Nearest Neighbor frente a MST + DFS', '', ...t3, ''
);

const md = out.join('\n');
console.log(md);
const mdPath = `${file.replace(/\.csv$/, '')}-tablas.md`;
fs.writeFileSync(mdPath, md);
console.log(`\nTablas guardadas en ${mdPath}`);
