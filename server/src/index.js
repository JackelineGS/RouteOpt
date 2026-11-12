const fs = require('fs');
const config = require('./config');
const { createApp } = require('./app');

if (!fs.existsSync(config.ENGINE_PATH)) {
  console.warn(`AVISO: no existe el motor en ${config.ENGINE_PATH}. Compila engine/ primero.`);
}

createApp().listen(config.PORT, config.HOST, () => {
  console.log(`API de RouteOpt en http://${config.HOST}:${config.PORT}`);
  console.log(`Motor: ${config.ENGINE_PATH}`);
});

