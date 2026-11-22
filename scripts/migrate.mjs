import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const dir = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  for (const file of files) {
    await client.query(readFileSync(join(dir, file), 'utf8'))
    console.log(`Applied ${file}`)
  }
} finally {
  await client.end()
}
