const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Set session timezone for all new connections
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Kolkata'");
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
