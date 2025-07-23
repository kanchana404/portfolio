// utils/mongodb.ts

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is missing from environment variables');
}

let cached = (global as any).mongoose || { conn: null, promise: null };

export const connectToDatabase = async () => {
  // If already connected, return the existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If there's an existing connection but it's not ready, wait for it
  if (mongoose.connection.readyState === 2) {
    // Connection is connecting, wait for it
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
    });
    cached.conn = mongoose.connection;
    return cached.conn;
  }

  // If there's an existing connection but it's not to our database, disconnect first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Create new connection if no cached promise exists
  if (!cached.promise) {
    const options = {
      dbName: 'kavitha',
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // 5 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      minPoolSize: 5,
    };
    
    cached.promise = mongoose.connect(MONGODB_URI, options);
  }

  try {
    cached.conn = await cached.promise;
    console.log('Connected to MongoDB successfully');
    return cached.conn;
  } catch (error) {
    // Reset the cached promise if connection fails
    cached.promise = null;
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// Optional: Export a disconnect function for cleanup
export const disconnectFromDatabase = async () => {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log('Disconnected from MongoDB');
  }
};