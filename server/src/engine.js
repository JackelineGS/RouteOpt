const { spawn } = require('child_process');
const config = require('./config');

class EngineFailure extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Lanza el ejecutable, le envía el JSON por stdin y lee el JSON de stdout.
function spawnEngine(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ENGINE_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks = [];
    let outBytes = 0;
    let errText = '';
    let settled = false;
    let timer = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(
        reject,
        new EngineFailure(
          'ENGINE_TIMEOUT',
          `El motor no respondió en ${timeoutMs} ms y fue detenido`
        )
      );
    }, timeoutMs);

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        finish(
          reject,
          new EngineFailure(
            'ENGINE_NOT_FOUND',
            `No se encontró el motor en ${config.ENGINE_PATH}. ¿Compilaste engine/?`
          )
        );
      } else {
        finish(reject, new EngineFailure('ENGINE_START_FAILED', err.message));
      }
    });

    child.stdout.on('data', (chunk) => {
      outBytes += chunk.length;
      if (outBytes > config.MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        finish(
          reject,
          new EngineFailure('ENGINE_OUTPUT_TOO_LARGE', 'La salida del motor es demasiado grande')
        );
        return;
      }
      chunks.push(chunk);
    });

    child.stderr.on('data', (chunk) => {
      if (errText.length < 4000) errText += chunk.toString();
    });

    child.on('close', (code, signal) => {
      if (code !== 0) {
        const extra = signal ? ` (señal ${signal})` : '';
        finish(
          reject,
          new EngineFailure(
            'ENGINE_CRASHED',
            `El motor terminó con código ${code}${extra}. ${errText.trim()}`.trim()
          )
        );
        return;
      }
      try {
        finish(resolve, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        finish(
          reject,
          new EngineFailure('ENGINE_BAD_OUTPUT', 'El motor devolvió algo que no es JSON válido')
        );
      }
    });

    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(request));
  });
}

// Cola: una sola ejecución del motor a la vez, para no contaminar los tiempos medidos.
let queue = Promise.resolve();

function runEngine(request, { timeoutMs = 15000 } = {}) {
  const run = queue.then(() => spawnEngine(request, timeoutMs));
  queue = run.catch(() => {});
  return run;
}

module.exports = { runEngine, EngineFailure };



