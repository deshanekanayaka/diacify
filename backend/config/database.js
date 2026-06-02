/*
 * Database.js
 * This file is responsible for creating and managing a reusable MySQL
 * connection pool for the application.
 *
 * This allows controllers to use the same connection instead of creating
 * new ones each time
 */

import mysql from 'mysql2';

// Creates a pool of reusable MySQL connections instead of opening a new
// connection on every request — improves performance under concurrent load
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'diabetic_db',
  port: process.env.DB_PORT || 3306,
  // Queues requests when all connections are busy instead of rejecting them
  waitForConnections: true,
  // Caps simultaneous connections to avoid overloading the database
  connectionLimit: 10,
  // No limit on queued connection requests
  queueLimit: 0
});

// Wraps the pool with promise support so async/await can be used instead of callbacks
const promisePool = pool.promise();

// Runs a lightweight query to confirm the database is reachable at startup
async function testConnection() {
  try {
    await promisePool.query('SELECT 1');
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Used for SELECT statements — returns the rows array from the result
// throws on failure so the calling controller handles the error
async function query(sql, params = []) {
  const [rows] = await promisePool.query(sql, params);
  return rows;
}

// Used for INSERT/UPDATE/DELETE — returns result metadata e.g. insertId, affectedRows
// throws on failure so the calling controller handles the error
async function execute(sql, params = []) {
  const [result] = await promisePool.execute(sql, params);
  return result;
}

// Convenience wrapper around query() that returns only the first row
// returns null instead of undefined if no match found — easier for callers to check
async function queryOne(sql, params = []) {
  const [rows] = await promisePool.query(sql, params);
  return rows[0] || null;
}

// Gracefully releases all connections when the app shuts down
// prevents dangling connections from staying open on the database server
async function closePool() {
  try {
    await promisePool.end();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error.message);
  }
}

export { promisePool as pool, testConnection, query, execute, queryOne, closePool };