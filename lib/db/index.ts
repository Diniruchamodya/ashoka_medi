import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import WebSocket from 'ws'
import * as schema from './schema'

neonConfig.webSocketConstructor = WebSocket

const globalForDb = globalThis as unknown as {
  pool?: Pool
}

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool
}

export const db = drizzle(pool, { schema })