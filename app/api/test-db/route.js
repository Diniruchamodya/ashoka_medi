
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`SELECT NOW() AS server_time`;

    return NextResponse.json({
      success: true,
      message: "Ashoka Medi-Lab connected to Neon!",
      serverTime: result[0].server_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
