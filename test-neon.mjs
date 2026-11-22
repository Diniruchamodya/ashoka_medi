
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");

const match = env.match(/^DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);

if (!match) {
  throw new Error("DATABASE_URL not found in .env.local");
}

const sql = neon(match[1]);

try {
  const result = await sql`SELECT NOW() AS current_time`;
  console.log("Neon connection successful!");
  console.log(result);
} catch (error) {
  console.error("Neon connection failed:", error.message);
}
