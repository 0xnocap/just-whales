import pg from 'pg';

let pool: pg.Pool | null = null;

export async function getPool(): Promise<pg.Pool> {
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}
