import { startServer } from './interfaces/http/server.js';

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
