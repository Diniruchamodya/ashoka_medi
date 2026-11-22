import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

config({ path: ".env.local" });

neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

try {
  console.log("Connecting to Neon...");

  const result = await pool.query("SELECT NOW()");

  console.log("Database connected!");
  console.log(result.rows);
} catch (error) {
  console.error("Database connection failed:");
  console.error(error);
} finally {
  await pool.end();
}