import { loadConfig } from './config.js';
import { createServer } from './server.js';

async function main() {
  const config = loadConfig();
  const app = await createServer(config);

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Telemetry bridge listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
