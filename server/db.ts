import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@shared/schema";

// Initialize Postgres client with connection string from environment
export const client = postgres(process.env.DATABASE_URL!, {
  max: 10, // Maximum number of connections in the pool
});

// Initialize Drizzle with the client and schema
export const db = drizzle(client, { schema });