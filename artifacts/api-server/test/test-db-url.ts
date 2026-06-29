// Derives a dedicated test database URL from the runtime Postgres connection so
// the integration tests never read from or mutate the development database.
export function deriveTestDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL must be set to derive a test database URL. Is the database provisioned?",
    );
  }
  const url = new URL(base);
  const currentName = decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
  url.pathname = `/${currentName}_test`;
  return url.toString();
}

// Connection URL to the maintenance database, used only to CREATE/DROP the
// throwaway test database itself.
export function deriveAdminDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL must be set to derive an admin database URL.");
  }
  const url = new URL(base);
  url.pathname = "/postgres";
  return url.toString();
}

export function testDatabaseName(): string {
  return decodeURIComponent(new URL(deriveTestDatabaseUrl()).pathname.replace(/^\//, ""));
}
