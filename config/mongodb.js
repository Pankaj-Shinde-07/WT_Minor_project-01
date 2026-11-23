const mongoose = require('mongoose');

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobconnect';

  try {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4 to prevent Windows IPv6 DNS SRV timeouts
    };

    const conn = await mongoose.connect(uri, opts);
    cachedConnection = conn;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
    throw error;
  }
}

module.exports = connectDB;
