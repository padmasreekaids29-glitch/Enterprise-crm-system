import 'dotenv/config';
import { createApiApp } from './app.ts';
import { connectDatabase } from './config/db.ts';
import { seedDatabase } from './seed/seedData.ts';

const PORT = Number(process.env.PORT) || 5000;

async function startStandaloneBackend() {
  await connectDatabase();
  await seedDatabase();

  const app = createApiApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEXORA Backend] Standalone API server running on http://localhost:${PORT}`);
  });
}

startStandaloneBackend().catch((err) => {
  console.error('[NEXORA Backend] Failed to start:', err);
  process.exit(1);
});
