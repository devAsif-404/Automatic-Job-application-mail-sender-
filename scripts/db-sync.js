const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

console.log(`[DB-Sync] Detected DATABASE_URL: ${dbUrl.replace(/:[^:@]*@/, ':****@')}`);
console.log(`[DB-Sync] Target Database Provider: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

const targetSchema = isPostgres
  ? path.join(__dirname, '..', 'prisma', 'schema.prisma')
  : path.join(__dirname, '..', 'prisma', 'schema.sqlite.prisma');

const activeSchema = path.join(__dirname, '..', 'prisma', 'schema.active.prisma');

fs.copyFileSync(targetSchema, activeSchema);
console.log(`[DB-Sync] Copied schema to prisma/schema.active.prisma`);

try {
  console.log(`[DB-Sync] Generating Prisma client...`);
  execSync(`npx prisma generate --schema=prisma/schema.active.prisma`, { stdio: 'inherit' });
  console.log(`[DB-Sync] Pushing schema to database...`);
  execSync(`npx prisma db push --schema=prisma/schema.active.prisma --accept-data-loss`, { stdio: 'inherit' });
  console.log(`[DB-Sync] Database synchronized successfully!`);
} catch (err) {
  console.error(`[DB-Sync] Database synchronization failed:`, err.message);
  process.exit(1);
}
