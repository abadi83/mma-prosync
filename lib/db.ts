import { Pool, types } from 'pg';

// Parse numeric/integer sebagai number, bukan string
if (!types) {
  throw new Error('pg types unavailable');
}

types.setTypeParser(types.builtins.INT8, (val: string) => Number(val));
types.setTypeParser(types.builtins.NUMERIC, (val: string) => Number(val));

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'mma_prosync',
    user: process.env.DB_USER || 'mma_admin',
    password: process.env.DB_PASSWORD || 'mma_prosync_2024!',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

const pool = createPool();

export default pool;

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function queryRow<T = any>(text: string, params?: any[]): Promise<T | null> {
  const { rows } = await query(text, params);
  return rows[0] || null;
}

export async function queryRows<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await query(text, params);
  return rows;
}
