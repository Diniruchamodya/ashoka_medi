import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

try {
  console.log("Testing Neon HTTP connection...");

  const result = await sql`SELECT NOW() AS server_time`;

  console.log("SUCCESS!");
  console.log(result);
} catch (error) {
  console.error("FAILED:");
  console.error(error.message);
  console.error("Cause:", error.cause);
}