import mongoose from 'mongoose';

let memoryServer: { stop: () => Promise<boolean>; getUri: () => string } | null = null;
let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const configuredUri = process.env.MONGODB_URI?.trim();

  if (configuredUri) {
    try {
      await mongoose.connect(configuredUri);
      isConnected = true;
      console.log('[NEXORA DB] Connected to external MongoDB instance.');
      return;
    } catch (error) {
      console.warn(
        '[NEXORA DB] Could not connect to configured MONGODB_URI, falling back to MongoMemoryServer:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'nexora_crm',
    },
  });

  const uri = memoryServer.getUri();
  await mongoose.connect(uri);
  isConnected = true;
  console.log(`[NEXORA DB] Connected to embedded MongoDB engine (${uri})`);
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  isConnected = false;
}
