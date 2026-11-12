# RouteOpt

Sistema para comparar estrategias algorítmicas que resuelven rutas de distribución
desde un centro logístico hacia múltiples clientes (variante del problema del viajante, TSP):
algoritmos exactos, aproximados y heurísticos.

Curso: Análisis y Diseño de Algoritmos · USIL · Profesor: Castañeda Alban, Jorge Eduardo · 2026-II

**Pregunta del proyecto:** ¿cómo seleccionar y aplicar una estrategia algorítmica para obtener
rutas de alta calidad, considerando el crecimiento del número de destinos, el costo
computacional y la diferencia entre soluciones exactas, aproximadas y heurísticas?

## 1. Estado del proyecto

| Componente | Estado |
|---|---|
| Motor C++: carga y validación de instancias, generador con semilla, Haversine | Hecho |
| Algoritmos: Nearest Neighbor, MST + DFS (Prim), Held-Karp, Backtracking con poda | Hecho y verificado (`routeopt-tests`) |
| Medición de tiempo, memoria y operaciones | Hecho |
| Servidor Node: `health`, `generate`, `solve`, `compare` (con cálculo del gap) | Hecho |
| Web React: mapa, generar instancia, comparar algoritmos, tabla de resultados | Hecho |
| Script de benchmark y de tablas | Hecho |
| API externa de distancias por calles (con caché) | Pendiente |
| Importador CSV/JSON y geocodificación | Pendiente |
| Recomendación adaptativa según el tamaño | Pendiente |
| Exportación desde la web y gráficos | Pendiente |

## 2. Arquitectura y carpetas

Los bloques a–e son los de la propuesta del profesor. El detalle de los mensajes entre las
piezas está en [`docs/contratos.md`](docs/contratos.md).

| Carpeta | Bloque | Contenido |
|---|---|---|
| `web/` | a) Presentación | React + Vite + Leaflet |
| `server/` | API REST local | Node + Express: lanza el motor, calcula el gap, scripts de benchmark |
| `engine/` | b) Lógica de negocio y e) Motor algorítmico | C++17: instancias, grafo, algoritmos, métricas, pruebas |
| `data/` | d) Capa de datos | Instancias, caché de matrices, resultados de experimentos |
| `docs/` | | Contratos entre las piezas |

Flujo: React → servidor Node (`127.0.0.1:3001`) → ejecutable `routeopt-engine`
(recibe JSON por la entrada estándar y responde JSON por la salida estándar; un proceso
por ejecución).

![Arquitectura lógica de RouteOpt](docs/arquitectura.png)
*Figura 1. Arquitectura lógica de RouteOpt. El diagrama muestra el diseño completo del
sistema; los componentes que aún no están implementados figuran en la tabla de la sección 1.*

## 3. Requisitos (Ubuntu)

```bash
sudo apt update
sudo apt install -y build-essential cmake git curl jq
```

- `g++` con soporte de C++17 y `cmake` 3.16 o superior.
- Node.js (se desarrolló con la v26; instalación recomendada con `nvm`) y `npm`.
- `jq` solo se usa para las pruebas manuales con `curl`.
- La biblioteca de JSON del motor (`nlohmann/json`) ya viene dentro del repositorio.
- La medición de memoria lee `/proc`, así que solo funciona en Linux.

## 4. Instalación y arranque

### 4.1 Motor (C++)

```bash
cd engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
./build/routeopt-tests
```

Debe terminar con `0 fallos`. Siempre compilar en modo Release: sin optimización los
tiempos no son comparables.

Prueba rápida del motor:

```bash
echo '{"mode":"ping"}' | ./build/routeopt-engine
echo '{"mode":"generate","n":5,"seed":42}' | ./build/routeopt-engine
```

### 4.2 Servidor (Node)

```bash
cd server
npm install
npm test        # pruebas del cálculo del gap
npm start       # queda corriendo en http://127.0.0.1:3001
```

Comprobación (en otra terminal): `curl -s localhost:3001/api/health | jq`

### 4.3 Web (React)

Con el servidor corriendo, en otra terminal:

```bash
cd web
npm install
npm run dev     # abrir http://localhost:5173
```

El mapa necesita internet para cargar las imágenes de fondo.

## 5. Algoritmos

`N` es el número total de nodos, incluyendo el depósito (nodo 0).

| Algoritmo | Tipo | Complejidad | Tamaño máximo | Qué cuenta `operations` |
|---|---|---|---|---|
| Nearest Neighbor | Heurística voraz | O(N²) | 5000 | Comparaciones de distancias |
| MST + DFS (Prim) | Aproximado | O(N²) | 5000 | Aristas evaluadas, N(N−1)/2 |
| Held-Karp | Exacto, programación dinámica | Tiempo O(N²·2ᴺ), memoria O(N·2ᴺ) | 20 | Transiciones de la tabla |
| Backtracking (branch and bound) | Exacto, con poda | Peor caso factorial | 100 | Nodos del árbol explorados |

- **MST + DFS** es una 2-aproximación solo si la matriz es simétrica y cumple la desigualdad
  triangular.
- **Backtracking** parte de la solución de Nearest Neighbor como cota inicial y poda una
  rama cuando el costo parcial más la suma de la arista de salida más barata de cada nodo
  pendiente iguala o supera la mejor ruta conocida. Su límite práctico lo pone el tiempo.
- **Held-Karp** usa máscaras de bits. Su límite lo pone la memoria (unos 90 MB con N=20).
- La ruta empieza en el nodo 0 y el costo incluye el regreso al depósito.

## 6. Benchmark (para el informe)

Reglas para que los datos sean válidos:

1. **Una sola persona corre la corrida oficial, en un solo equipo.** Los tiempos de equipos
   distintos no se pueden comparar. El archivo `.meta.json` registra el equipo usado.
2. Cerrar el servidor (`npm start`), el navegador y cualquier programa pesado. Conectar el
   equipo a la corriente y no usarlo mientras corre.
3. No ejecutar nada más en paralelo.

```bash
cd server

# Prueba corta (borrar su resultado después)
node scripts/benchmark.js --sizes=5,10 --seeds=2 --reps=3
node scripts/summarize.js
rm ../data/results/benchmark-*

# Corrida completa: N = 5, 10 a 18, 20 y 50; 10 semillas; límite de 10 s por algoritmo
node scripts/benchmark.js
node scripts/summarize.js
```

La corrida completa toma unos 6 a 10 minutos (estimación: depende del equipo y de lo que
tarde el backtracking en N=17 y 18). Lo que más pesa son los tiempos agotados en N=20 y 50.

Opciones: `--sizes=5,10,15`, `--seeds=10`, `--reps=5`, `--limit=10000` (milisegundos) y
`--out=ruta.csv`. Cada instancia se repite hasta 5 veces solo si la primera ejecución dura
menos de 500 ms; se guarda la mediana.

Salidas en `data/results/`:

- `benchmark-FECHA.csv`: una fila por instancia y algoritmo (costo, gap, tiempo mediano,
  mínimo y máximo, repeticiones, operaciones, memoria extra).
- `benchmark-FECHA.csv.meta.json`: equipo, versiones y parámetros del experimento.
- `benchmark-FECHA-tablas.md`: las tablas del informe (comparación por tamaño y algoritmo,
  viabilidad del backtracking, Nearest Neighbor frente a MST + DFS).

Los resultados **sí** se suben al repositorio: son la evidencia del informe.

**Cómo leer los gaps:**

- `gap = (costo − referencia) / referencia × 100`.
- Si terminó un algoritmo exacto (Held-Karp o backtracking), la referencia es el **óptimo**.
- Si no (N=50, por ejemplo), la referencia es la **mejor solución conocida** entre los
  algoritmos que terminaron, y el gap **no** es respecto al óptimo. El informe debe decirlo.
- "Viable" depende del límite de tiempo: indicar siempre con qué límite se midió.
- La memoria extra (pico menos memoria base) solo es significativa para Held-Karp; en los
  demás es ruido del sistema.

**Reproducibilidad:** con la misma `n`, la misma semilla y la misma área, el generador produce
siempre la misma instancia (`gen-n10-seed42`). Lo único que varía entre corridas son los tiempos.

## 7. API REST (resumen)

Detalle completo, con formatos y códigos de error, en [`docs/contratos.md`](docs/contratos.md).

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | Comprueba el servidor y el motor |
| `POST /api/instances/generate` | Genera una instancia (`n`, `seed`) |
| `POST /api/solve` | Resuelve con un algoritmo |
| `POST /api/compare` | Ejecuta varios algoritmos en serie y calcula el gap |

Las ejecuciones del motor se atienden una a la vez para no contaminar los tiempos.

## 8. Supuestos y limitaciones

- Un solo vehículo, sin ventanas de tiempo, capacidad suficiente (TSP simétrico).
- Hoy las distancias son Haversine (línea recta sobre la esfera): simétricas y con
  desigualdad triangular por construcción. El código valida que la matriz sea n×n, con
  diagonal 0, pesos finitos y no negativos, y simétrica; **no** comprueba la desigualdad
  triangular, y en matrices que vengan de archivo se asume.
- Las instancias de los experimentos son aleatorias uniformes sobre un rectángulo de Lima:
  sirven para comparar algoritmos, no para afirmar nada sobre la operación de una empresa real.
- Las líneas del mapa son rectas porque las distancias son Haversine.

## 9. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `npm start` dice que no encuentra `package.json` | Estás en otra carpeta. Verificar con `pwd`: servidor en `server/`, web en `web/` |
| "No existe el motor en ..." | Falta compilar: `cmake --build build -j` dentro de `engine/` |
| La web dice "No se pudo conectar con el servidor" | El servidor no está corriendo: `npm start` dentro de `server/` |
| `curl` falla con "La lista de argumentos es demasiado larga" | Una instancia grande no cabe en `-d "..."`. Enviar el cuerpo por la entrada estándar con `--data-binary @-` |
| Las pruebas del motor dan `FALLO` | No usar los números de ese equipo; avisar con la línea del fallo |

## 10. Licencia

MIT (ver `LICENSE`).
