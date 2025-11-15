import { defineConfig } from "drizzle-kit";

// This staging Repl uses only DATABASE_URL_STAGING
if (!process.env.DATABASE_URL_STAGING) {
  throw new Error("DATABASE_URL_STAGING is required. Ensure the staging database is provisioned.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_STAGING,
  },
});
