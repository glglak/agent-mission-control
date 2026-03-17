export interface Config {
  port: number;
  dbPath: string;
  wsPath: string;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env['PORT'] ?? '4700', 10),
    dbPath: process.env['DB_PATH'] ?? './amc.db',
    wsPath: process.env['WS_PATH'] ?? '/ws',
  };
}
