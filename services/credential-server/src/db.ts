import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { Pool, QueryResultRow } from "pg";
import { config } from "./config";

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

async function ensureMigrationTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

function getMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, "../migrations"),
    path.resolve(process.cwd(), "migrations"),
    path.resolve(process.cwd(), "services/credential-server/migrations"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationTable();
  const migrationDir = getMigrationsDir();
  const migrationFiles = [
    "001_create_templates.sql",
    "002_create_credentials.sql",
    "003_multi_tenant_auth.sql",
    "004_change_credentials_id_to_text.sql",
    "005_add_verifier_role.sql",
    "006_simplify_user_roles.sql",
    "007_account_change_requests.sql",
    "008_template_auto_issue.sql",
  ];

  for (const migrationFile of migrationFiles) {
    const version = migrationFile;
    const existing = await pool.query(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [version]
    );
    if (existing.rowCount) {
      continue;
    }

    const filePath = path.join(migrationDir, migrationFile);
    const sql = await readFile(filePath, "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(version, applied_at) VALUES($1, NOW())",
        [version]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
