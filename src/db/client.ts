import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,// Maximum connections in pool
  idleTimeoutMillis: 30_000, // Close idle connections after 30s
  connectionTimeoutMillis: 5_000,// Fail if can't connect in 5s
});
export const db = drizzle(pool, { schema });
export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };