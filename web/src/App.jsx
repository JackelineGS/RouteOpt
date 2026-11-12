import { useState } from 'react'
import MapView from './MapView.jsx'
import { generateInstance, compareAlgorithms } from './api.js'
import './App.css'

const ALGORITHMS = [
  { id: 'nearest_neighbor', label: 'Nearest Neighbor', kind: 'Heurística', color: '#d97706' },
  { id: 'mst_dfs', label: 'MST + DFS', kind: 'Aproximado', color: '#7c3aed' },
  { id: 'held_karp', label: 'Held-Karp', kind: 'Exacto, máx. 20 nodos', color: '#059669' },
  { id: 'backtracking', label: 'Backtracking (B&B)', kind: 'Exacto, con poda', color: '#0891b2' },
]
const STATUS_LABEL = { ok: 'OK', timeout: 'Tiempo agotado', skipped: 'No admite este tamaño' }

const algoMeta = (id) => ALGORITHMS.find((a) => a.id === id) || { label: id, kind: '', color: '#374151' }
const fmtKm = (m) => (m / 1000).toFixed(2)
const fmtMs = (ms) => (ms < 1 ? ms.toFixed(3) : ms.toFixed(2))

function parseIntIn(value, min, max, name) {
  const text = String(value).trim()
  const v = Number(text)
  if (text === '' || !Number.isInteger(v) || v < min || v > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}`)
  }
  return v
}

function ReferenceNote({ reference }) {
  if (!reference) {
    return (
      <div className="banner warn">
        Ningún algoritmo terminó, así que no hay referencia para calcular el gap.
      </div>
    )
  }
  if (reference.type === 'optimal') {
    return (
      <div className="banner">
        Referencia: <strong>óptimo</strong> (confirmado por un algoritmo exacto), {fmtKm(reference.cost_m)} km. Los gaps son
        respecto al óptimo.
      </div>
    )
  }
  return (
    <div className="banner warn">
      Referencia: <strong>mejor solución conocida</strong> ({algoMeta(reference.algorithm).label},{' '}
      {fmtKm(reference.cost_m)} km). Ningun algoritmo exacto termino, asi que los gaps <strong>no</strong> son
      respecto al óptimo.
    </div>
  )
}

function ResultsTable({ results, best, shownAlgo, onShow }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Algoritmo</th>
            <th>Estado</th>
            <th>Costo (km)</th>
            <th>Gap (%)</th>
            <th>Tiempo (ms)</th>
            <th>Operaciones</th>
            <th title="Pico de memoria menos la memoria base. En instancias chicas puede variar unos 64 KB por ruido del sistema.">
              Memoria extra (KB)
            </th>
            <th>Mapa</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const meta = algoMeta(r.algorithm)
            const ok = r.status === 'ok'
            const m = r.metrics
            return (
              <tr key={r.algorithm} className={r.algorithm === best ? 'best' : ''}>
                <td>
                  <span className="dot" style={{ background: meta.color }} />
                  {meta.label}
                  <span className="kind"> · {meta.kind}</span>
                </td>
                <td>{STATUS_LABEL[r.status] || r.status}</td>
                <td>{ok ? fmtKm(r.cost_m) : '—'}</td>
                <td>{r.gap_pct == null ? '—' : r.gap_pct.toFixed(2)}</td>
                <td>{m ? fmtMs(m.time_ms) : '—'}</td>
                <td>{m ? m.operations.toLocaleString('es-PE') : '—'}</td>
                <td>
                  {m
                    ? Math.max(0, m.peak_memory_kb - m.baseline_memory_kb).toLocaleString('es-PE')
                    : '—'}
                </td>
                <td>
                  {ok ? (
                    <button
                      className="secondary small"
                      onClick={() => onShow(r.algorithm)}
                      disabled={shownAlgo === r.algorithm}
                    >
                      {shownAlgo === r.algorithm ? 'Mostrando' : 'Ver ruta'}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function App() {
  const [n, setN] = useState('10')
  const [seed, setSeed] = useState('42')
  const [limitSec, setLimitSec] = useState('10')
  const [selected, setSelected] = useState(ALGORITHMS.map((a) => a.id))
  const [instance, setInstance] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [shownAlgo, setShownAlgo] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  function toggleAlgo(id) {
    setSelected((prev) =>
      ALGORITHMS.map((a) => a.id).filter((x) => (x === id ? !prev.includes(x) : prev.includes(x)))
    )
  }

  async function handleGenerate() {
    setError(null)
    try {
      const nodes = parseIntIn(n, 2, 2000, 'El número de nodos')
      const s = parseIntIn(seed, 0, 4294967295, 'La semilla')
      setBusy('generate')
      const data = await generateInstance(nodes, s)
      setInstance(data.instance)
      setComparison(null)
      setShownAlgo(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleCompare() {
    setError(null)
    try {
      if (!instance) throw new Error('Primero genera una instancia')
      if (selected.length === 0) throw new Error('Selecciona al menos un algoritmo')
      const sec = parseIntIn(limitSec, 1, 120, 'El tiempo límite')
      setBusy('compare')
      const result = await compareAlgorithms(instance, selected, sec * 1000)
      setComparison(result)
      setShownAlgo(result.best_algorithm)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const shown = comparison
    ? comparison.results.find((r) => r.algorithm === shownAlgo && r.status === 'ok')
    : null
  const route = shown ? shown.route : null
  const routeColor = shown ? algoMeta(shown.algorithm).color : '#374151'
  const working = busy !== null

  return (
    <div className="app">
      <header>
        <h1>RouteOpt</h1>
        <p>Estrategias algorítmicas para rutas de distribución (TSP): exactas, aproximadas y heurísticas.</p>
      </header>

      <div className="layout">
        <aside className="panel">
          <h2>1. Instancia</h2>
          <div className="row">
            <label className="field">
              Nodos (con depósito)
              <input value={n} onChange={(e) => setN(e.target.value)} inputMode="numeric" />
            </label>
            <label className="field">
              Semilla
              <input value={seed} onChange={(e) => setSeed(e.target.value)} inputMode="numeric" />
            </label>
          </div>
          <div className="row">
            <button onClick={handleGenerate} disabled={working}>
              {busy === 'generate' ? 'Generando…' : 'Generar instancia'}
            </button>
            <button
              className="secondary"
              disabled={working}
              onClick={() => setSeed(String(Math.floor(Math.random() * 1000000)))}
              title="Pone una semilla al azar. La semilla queda visible para poder repetir la instancia."
            >
              Semilla al azar
            </button>
          </div>

          <h2>2. Algoritmos</h2>
          {ALGORITHMS.map((a) => (
            <label key={a.id} className="check">
              <input
                type="checkbox"
                checked={selected.includes(a.id)}
                onChange={() => toggleAlgo(a.id)}
                disabled={working}
              />
              <span>
                <span className="dot" style={{ background: a.color }} />
                {a.label}
                <small>{a.kind}</small>
              </span>
            </label>
          ))}
          <label className="field">
            Tiempo límite por algoritmo (s)
            <input
              value={limitSec}
              onChange={(e) => setLimitSec(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <button onClick={handleCompare} disabled={working || !instance}>
            {busy === 'compare' ? 'Ejecutando…' : 'Comparar algoritmos'}
          </button>

          {error && <div className="error">{error}</div>}

          {instance && (
            <p className="info">
              Instancia <strong>{instance.id}</strong>: {instance.nodes.length} nodos (1 depósito +{' '}
              {instance.nodes.length - 1} clientes). Distancias: {instance.distance_source}.
            </p>
          )}
        </aside>

        <main>
          <MapView instance={instance} route={route} routeColor={routeColor} />
          <p className="map-note">
            Punto rojo (D): centro de distribución. El número dentro del círculo es el id del
            cliente (el mismo de la tabla y de la ruta); la insignia blanca indica el orden de
            visita de la ruta mostrada. Las etiquetas se muestran hasta 40 nodos. Las líneas son
            rectas porque las distancias son Haversine (modo simulado).
          </p>
        </main>
      </div>

      {comparison && (
        <section className="results">
          <h2>Resultados · {comparison.n} nodos</h2>
          <ReferenceNote reference={comparison.reference} />
          <ResultsTable
            results={comparison.results}
            best={comparison.best_algorithm}
            shownAlgo={shownAlgo}
            onShow={setShownAlgo}
          />
          {route && (
            <p className="route-text">
              <strong>{algoMeta(shownAlgo).label}:</strong>{' '}
              {route.length <= 60
                ? [...route, route[0]].join(' → ')
                : `ruta de ${route.length} nodos (demasiado larga para listarla; se ve en el mapa)`}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
