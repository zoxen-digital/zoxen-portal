import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const g = globalThis as unknown as { _mongoose?: Cache };
const cached: Cache = g._mongoose ?? (g._mongoose = { conn: null, promise: null });

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  // Register every model before the first query (a page that populates "client" may never import Client itself).
  await import("@/models/all");

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to your .env.local file.");

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB || undefined,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
