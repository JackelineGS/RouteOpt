# Contratos de RouteOpt (versión 0.1)

Este documento es la referencia única de cómo se comunican las tres piezas:
React (`web/`) → Node (`server/`) → motor C++ (`engine/`).
Si algo cambia, se modifica este archivo primero y se avisa al equipo.

## 1. Convenciones generales

- El nodo 0 es siempre el depósito. Los clientes son 1..n-1.
- `n` es el total de nodos, incluyendo el depósito (N = |V|).
- Las distancias van en metros.
- La ruta empieza en el nodo 0 y no repite el regreso. El costo sí incluye el arco de vuelta.
- Algoritmos: `nearest_neighbor`, `mst_dfs`, `held_karp`, `backtracking`.
- Las matrices enviadas deben ser simétricas, con diagonal 0 y pesos no negativos.

## 2. Formato de instancia (compartido por todo el sistema)

```json
{
  "id": "gen-n10-seed42",
  "nodes": [
    {"id": 0, "name": "Centro de distribución", "lat": -12.05, "lon": -77.04},
    {"id": 1, "name": "Cliente 1", "lat": -12.07, "lon": -77.02}
  ],
  "distance_source": "haversine",
  "matrix": null
}
```

- `distance_source`: `"haversine"` (el motor calcula la matriz con las coordenadas),
  `"matrix"` (viene en `matrix`, n×n, en metros).
- Para benchmarks grandes se usa siempre `haversine`: no se mueven matrices enormes por JSON.
- Cada resultado registra su `distance_source`; no se mezclan fuentes dentro de un experimento.

## 3. Node ↔ motor C++

El motor es el ejecutable `routeopt-engine`: lee un JSON por la entrada estándar
y escribe un JSON por la salida estándar. Los logs van a la salida de errores.
Se lanza un proceso por cada ejecución.

### 3.1 Modo `ping`

Entrada: `{"mode": "ping"}`
Salida: `{"status": "ok", "engine": "routeopt-engine", "version": "0.1.0"}`

### 3.2 Modo `generate`

```json
{"mode": "generate", "n": 10, "seed": 42,
 "area": {"lat_min": -12.15, "lat_max": -11.95, "lon_min": -77.12, "lon_max": -76.95}}
```

- `seed` por defecto: 42. `area` es opcional (por defecto, un rectángulo aproximado de Lima).
- Con la misma semilla, `n` y `area`, el resultado es idéntico (reproducibilidad).
- Respuesta: `{"status": "ok", "instance": { ...instancia... }}`

### 3.3 Modo `solve`

```json
{"mode": "solve", "algorithm": "nearest_neighbor",
 "instance": { ... }, "options": {"time_limit_ms": 10000}}
```

Respuesta:

```json
{
  "status": "ok",
  "algorithm": "nearest_neighbor",
  "instance_id": "gen-n10-seed42",
  "distance_source": "haversine",
  "route": [0, 4, 2, 1, 3],
  "cost_m": 38210.5,
  "metrics": {"time_ms": 0.4, "baseline_memory_kb": 4800, "peak_memory_kb": 5120, "operations": 25},
  "error": null
}
```

- `status`: `ok`, `timeout` o `error`.
- El tiempo se mide dentro de C++ con reloj monótono, sin contar el arranque del proceso.
- La memoria pico se lee del propio proceso.
- La memoria se reporta en dos cifras: `baseline_memory_kb` (justo antes de ejecutar el
  algoritmo) y `peak_memory_kb` (pico durante la ejecución). El incremento
  (`peak_memory_kb - baseline_memory_kb`) es lo atribuible al algoritmo.
- Si `status` es `timeout`, `route` y `cost_m` vienen en `null`. `metrics` sí se
  devuelve, con lo medido hasta el corte.


| Algoritmo | Tamaño máximo (nodos) | Qué cuenta `operations` |
|---|---|---|
| `nearest_neighbor` | 5000 | Comparaciones de distancias |
| `mst_dfs` | 5000 | Aristas evaluadas en Prim, n(n-1)/2 |
| `held_karp` | 20 | Transiciones de la tabla, m(m-1)·2^(m-2), con m = n-1 |


### 3.4 Modo `compare` (eliminado)

El motor ya no tiene modo `compare`. La comparación entre algoritmos, el cálculo del
gap y la referencia se hacen en el servidor Node (`POST /api/compare`, sección 4.4),
porque son operaciones sobre resultados ya calculados y no requieren un algoritmo.

### 3.5 Errores del motor

Los errores esperados salen como JSON (el proceso termina con código 0):

```json
{"status": "error", "error": {"code": "INVALID_INSTANCE", "message": "..."}}
```

| Código | Cuándo |
|---|---|
| `INVALID_INSTANCE` | Instancia mal formada, matriz inválida, coordenadas fuera de rango |
| `INSTANCE_TOO_LARGE` | n supera el límite del algoritmo (p. ej. Held-Karp) |
| `UNKNOWN_ALGORITHM` | Algoritmo no soportado |
| `UNKNOWN_MODE` | Modo no soportado |
| `INVALID_REQUEST` | JSON ilegible o faltan campos |
| `INTERNAL_ERROR` | Fallo inesperado del motor |

Si el proceso termina con un código distinto de 0, Node lo trata como caída del motor.

## 4. React ↔ Node (API REST local)

Todas las rutas empiezan por `/api`, usan JSON y devuelven los errores como
`{"error": {"code": "...", "message": "..."}}`.

| Método y ruta | Qué hace | Lo resuelve | Estado |
|---|---|---|---|
| `GET /api/health` | Comprueba que el servidor y el motor responden | Node + motor (`ping`) | Implementado |
| `POST /api/instances/generate` | Genera una instancia (`n`, `seed`, `area` opcional) | Motor (`generate`) | Implementado |
| `POST /api/solve` | Ejecuta un algoritmo sobre una instancia | Motor (`solve`) | Implementado |
| `POST /api/compare` | Ejecuta varios algoritmos en serie y calcula el gap | Node + motor (`solve`) | Implementado |
| `GET /api/recommendation?n=...` | Estrategia recomendada según el tamaño | Node | Pendiente |
| `POST /api/instances/import` | Importa un CSV o JSON y lo convierte a instancia | Node | Pendiente |
| `POST /api/geocode` | Dirección a latitud y longitud | Servicio externo | Pendiente |
| `POST /api/distances` | Matriz de distancias vía API externa (con caché) | Servicio externo | Pendiente |
| `POST /api/benchmark` | Lanza un experimento y devuelve un `job_id` | Node + motor | Pendiente |
| `GET /api/benchmark/:id` | Estado y resultados del experimento | Node | Pendiente |
| `GET /api/results/:id/export?format=csv\|json` | Descarga resultados | Node | Pendiente |

El benchmark es asíncrono: puede tardar minutos, y React consulta el estado
cada pocos segundos.

### 4.1 `POST /api/instances/generate`

Petición: `{"n": 10, "seed": 42}` → Respuesta: `{"instance": { ... }}`

### 4.2 `POST /api/solve`

Petición: `{"algorithm": "nearest_neighbor", "instance": { ... }, "options": {"time_limit_ms": 10000}}`
Respuesta: la misma que devuelve el modo `solve` del motor (sección 3.3).

### 4.3 Importador CSV

Columnas: `id,name,lat,lon,type`, con exactamente una fila de tipo `depot` y las
demás de tipo `client`.

### 4.4 `POST /api/compare`

Petición:

```json
{
  "instance": { "...": "..." },
  "algorithms": ["nearest_neighbor", "mst_dfs", "held_karp"],
  "options": {"time_limit_ms": 10000}
}
```

`algorithms` y `options` son opcionales. Por defecto corren los tres algoritmos.
Se ejecutan en serie sobre la misma instancia, para no distorsionar los tiempos.

Respuesta:

```json
{
  "instance_id": "gen-n10-seed42",
  "distance_source": "haversine",
  "n": 10,
  "reference": {"cost_m": 58355.5, "type": "optimal", "algorithm": "held_karp"},
  "best_algorithm": "held_karp",
  "results": [
    {"algorithm": "nearest_neighbor", "status": "ok", "cost_m": 59125.4, "gap_pct": 1.32}
  ]
}
```

- `gap_pct = (costo - referencia) / referencia * 100`.
- `reference.type` es `"optimal"` si Held-Karp terminó. Si no, es `"best_known"`:
  la mejor solución entre los algoritmos que sí terminaron. En ese caso los gaps
  no son respecto al óptimo y no deben presentarse como tales.
- Un algoritmo que no admite el tamaño de la instancia sale con `status: "skipped"`
  y `gap_pct: null`. Un `timeout` también queda con `gap_pct: null`.
- Cada elemento de `results` incluye además los campos de la respuesta de `solve`
  (`route`, `metrics`, etc.).

### 4.5 `GET /api/health`

Respuesta: `{"status": "ok", "server": "routeopt-server", "engine": { ... }}`,
donde `engine` es la respuesta del `ping` del motor.

### 4.6 Errores HTTP

| Estado | Códigos | Cuándo |
|---|---|---|
| 400 | `INVALID_INSTANCE`, `INVALID_REQUEST`, `UNKNOWN_ALGORITHM`, `UNKNOWN_MODE` | Datos de entrada inválidos |
| 404 | `NOT_FOUND` | La ruta no existe |
| 413 | `INVALID_REQUEST` | El cuerpo de la petición es demasiado grande |
| 422 | `INSTANCE_TOO_LARGE` | `/api/solve` con una instancia más grande de lo que admite el algoritmo |
| 500 | `INTERNAL_ERROR` | Fallo inesperado |
| 502 | `ENGINE_CRASHED`, `ENGINE_BAD_OUTPUT`, `ENGINE_OUTPUT_TOO_LARGE` | El motor falló o devolvió algo inválido |
| 503 | `ENGINE_NOT_FOUND`, `ENGINE_START_FAILED` | No se encontró o no se pudo lanzar el motor |
| 504 | `ENGINE_TIMEOUT` | El motor no respondió y el servidor lo detuvo |

Los errores se devuelven como `{"error": {"code": "...", "message": "..."}}`.

Un `timeout` del algoritmo (el que controla `time_limit_ms`) no es un error HTTP:
la respuesta es 200 con `status: "timeout"` y `route` y `cost_m` en `null`.
En `/api/compare`, `INSTANCE_TOO_LARGE` tampoco es un error: ese algoritmo sale
como `skipped`.

## 5. Registro de cambios

- 0.1: versión inicial.
- 0.2: se agrega `metrics.baseline_memory_kb`; se documenta que `timeout` devuelve
  `route` y `cost_m` en `null`; se elimina `"file"` como valor de `distance_source`.
- 0.3: algoritmos `mst_dfs` y `held_karp`; límites de tamaño por algoritmo.
- 0.4: el gap se calcula en el servidor (`/api/compare`); se elimina el modo `compare`
  del motor; se agregan `/api/health`, los estados `skipped` y los códigos de error HTTP.
