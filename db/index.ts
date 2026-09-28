import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

// Kept on the global so it survives module re-evaluation (dev HMR, and
// several route bundles in one warm lambda). It used to be read from the
// global but never written back, so each copy of the module connected anew.
const g = globalThis as typeof globalThis & { mongoose?: Cache };
g.mongoose ??= { conn: null, promise: null };
const cached = g.mongoose;

/**
 * One shared connection per warm lambda.
 *
 * Every caller awaits the same promise, so a request that arrives while the
 * first one is still connecting waits on it and fails with it too. (It used to
 * wait on a `connected` event with no error path, and hung until the function
 * timeout when Atlas was unreachable.)
 *
 * The pool is sized for serverless: minPoolSize 0, so an idle lambda holds no
 * Atlas connections, and a small maxPoolSize, because each lambda serves one
 * request at a time.
 */
export const connectToDatabase = async () => {
  // Check at call time (not import time) so build steps / sitemap generation
  // that merely import this module don't crash when the env var is absent.
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from environment variables');
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: 'kavitha',
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      minPoolSize: 0,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    // Let the next request try again.
    cached.promise = null;
    cached.conn = null;
    console.error('MongoDB connection error:', error);
    throw error;
  }
};
