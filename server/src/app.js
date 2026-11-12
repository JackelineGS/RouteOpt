const express = require('express');
const cors = require('cors');

const config = require('./config');
const { runEngine, EngineFailure } = require('./engine');
const { computeGaps } = require('./gap');
const { ApiError, statusFor } = require('./errors');

// Compatible con Express 4 y 5: los errores de funciones async llegan al manejador.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
}

async function callEngine(request, timeoutMs) {
  try {
    return await runEngine(request, { timeoutMs });
  } catch (e) {
    if (e instanceof EngineFailure) {
      throw new ApiError(statusFor(e.code), e.code, e.message);
    }
    throw e;
  }
}

function engineErrorToApi(r) {
  return new ApiError(statusFor(r.error.code), r.error.code, r.error.message);
}

function requireInstance(body) {
  const inst = body && body.instance;
  if (!inst || typeof inst !== 'object' || !Array.isArray(inst.nodes)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Falta "instance" con la lista "nodes"');
  }
  return inst;
}

function readTimeLimit(body) {
  const raw = body && body.options ? body.options.time_limit_ms : undefined;
  if (raw === undefined) return config.DEFAULT_TIME_LIMIT_MS;
  if (!Number.isInteger(raw) || raw <= 0 || raw > config.MAX_TIME_LIMIT_MS) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      `time_limit_ms debe ser un entero entre 1 y ${config.MAX_TIME_LIMIT_MS}`
    );
  }
  return raw;
}

function solveOnce(instance, algorithm, timeLimitMs) {
  return callEngine(
    {
      mode: 'solve',
      algorithm,
      instance,
      options: { time_limit_ms: timeLimitMs },
    },
    timeLimitMs + config.KILL_MARGIN_MS
  );
}

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_REQUEST', message: 'El cuerpo no es JSON válido' } });
  }
  if (err.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'INVALID_REQUEST', message: 'El cuerpo es demasiado grande' } });
  }
  console.error(err);
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
}

function createApp() {
  const app = express();
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json({ limit: '20mb' }));

  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      const engine = await callEngine({ mode: 'ping' }, 5000);
      res.json({ status: 'ok', server: 'routeopt-server', engine });
    })
  );

  app.post(
    '/api/instances/generate',
    asyncHandler(async (req, res) => {
      const { n, seed, area } = req.body || {};
      if (!Number.isInteger(n) || n < 2 || n > 5000) {
        throw new ApiError(400, 'INVALID_REQUEST', '"n" debe ser un entero entre 2 y 5000');
      }
      if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)) {
        throw new ApiError(400, 'INVALID_REQUEST', '"seed" debe ser un entero entre 0 y 4294967295');
      }
      const request = { mode: 'generate', n };
      if (seed !== undefined) request.seed = seed;
      if (area !== undefined) request.area = area;

      const r = await callEngine(request, 30000);
      if (r.status !== 'ok') throw engineErrorToApi(r);
      res.json({ instance: r.instance });
    })
  );

  app.post(
    '/api/solve',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const instance = requireInstance(body);
      if (!config.ALGORITHMS.includes(body.algorithm)) {
        throw new ApiError(
          400,
          'UNKNOWN_ALGORITHM',
          `Algoritmo no soportado. Opciones: ${config.ALGORITHMS.join(', ')}`
        );
      }
      const r = await solveOnce(instance, body.algorithm, readTimeLimit(body));
      if (r.status === 'error') throw engineErrorToApi(r);
      res.json(r);
    })
  );

  app.post(
    '/api/compare',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const instance = requireInstance(body);
      const timeLimit = readTimeLimit(body);

      const algorithms = body.algorithms === undefined ? config.ALGORITHMS : body.algorithms;
      if (
        !Array.isArray(algorithms) ||
        algorithms.length === 0 ||
        new Set(algorithms).size !== algorithms.length ||
        !algorithms.every((a) => config.ALGORITHMS.includes(a))
      ) {
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          `"algorithms" debe ser una lista sin repetidos con: ${config.ALGORITHMS.join(', ')}`
        );
      }

      // En serie a propósito: ejecutarlos en paralelo distorsionaría los tiempos.
      const results = [];
      for (const algorithm of algorithms) {
        const r = await solveOnce(instance, algorithm, timeLimit);
        if (r.status === 'error') {
          if (r.error.code === 'INSTANCE_TOO_LARGE') {
            results.push({ algorithm, status: 'skipped', error: r.error });
            continue;
          }
          throw engineErrorToApi(r);
        }
        results.push(r);
      }

      const first = results.find((r) => r.instance_id);
      const gaps = computeGaps(results);
      res.json({
        instance_id: first ? first.instance_id : null,
        distance_source: first ? first.distance_source : null,
        n: instance.nodes.length,
        reference: gaps.reference,
        best_algorithm: gaps.best_algorithm,
        results: gaps.results,
      });
    })
  );

  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` },
    });
  });
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

