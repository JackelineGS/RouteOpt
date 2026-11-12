async function post(path, body) {
  let res
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo "npm start" en server/?')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    if (data && data.error && data.error.message) throw new Error(data.error.message)
    if (res.status >= 500) {
      throw new Error('El servidor no responde. ¿Está corriendo "npm start" en server/?')
    }
    throw new Error(`Error HTTP ${res.status}`)
  }
  return data
}

export const generateInstance = (n, seed) => post('/api/instances/generate', { n, seed })

export const compareAlgorithms = (instance, algorithms, timeLimitMs) =>
  post('/api/compare', {
    instance,
    algorithms,
    options: { time_limit_ms: timeLimitMs },
  })
