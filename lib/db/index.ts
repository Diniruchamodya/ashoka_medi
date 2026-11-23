import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import WebSocket from 'ws'
import * as schema from './schema'

neonConfig.webSocketConstructor = WebSocket

const globalForDb = globalThis as unknown as {
  pool?: Pool
  rateLimitPool?: Pool
}

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })

export const rateLimitPool =
  globalForDb.rateLimitPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool
  globalForDb.rateLimitPool = rateLimitPool
}

export const db = drizzle(pool, { schema })