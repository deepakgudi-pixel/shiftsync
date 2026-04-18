const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
});
pool.on("error", (err) => console.error("DB error", err));
const query = (text, params) => pool.query(text, params);
module.exports = { query, pool };
