import pg from 'pg';

let pool: pg.Pool | null = null;

export async function getPool(): Promise<pg.Pool> {
  if (pool) return pool;
  const isLocal = process.env.POSTGRES_URL?.includes('localhost') || process.env.POSTGRES_URL?.includes('127.0.0.1');
  pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  return pool;
}
