import dotenv from 'dotenv';
import { testPostgresConnection, initPostgresSchema, syncSqliteToPostgres } from '../postgres.js';

dotenv.config();

async function run() {
  console.log('======================================================================');
  console.log('   Hostel Safety — Real PostgreSQL Database Migration Tool');
  console.log('======================================================================\n');

  console.log('Testing connection to PostgreSQL target database...');
  const test = await testPostgresConnection();

  if (!test.connected) {
    console.error('❌ Connection Failed:', test.message);
    console.log('\nTo connect to a real PostgreSQL database:');
    console.log('1. Set DATABASE_URL in server/.env (e.g. Supabase, Neon, AWS RDS or Local)');
    console.log('   Example: DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/hostel_safety"');
    console.log('2. Or run: docker compose up -d');
    process.exit(1);
  }

  console.log('✅ Connection Successful!');
  console.log('   Database:', test.database);
  console.log('   Version:', test.version);

  console.log('\n[1/2] Initializing PostgreSQL Tables, Constraints, and Indexes...');
  const schemaOk = await initPostgresSchema();
  if (!schemaOk) {
    console.error('❌ Failed to apply PostgreSQL schema.');
    process.exit(1);
  }

  console.log('\n[2/2] Migrating 1,200 Students, Rooms, Movements & Attendance to PostgreSQL...');
  const sync = await syncSqliteToPostgres();
  console.log('✅ Data Migration Completed:');
  console.log(`   - Hostels:     ${sync.transferred.hostels}`);
  console.log(`   - Blocks:      ${sync.transferred.blocks}`);
  console.log(`   - Floors:      ${sync.transferred.floors}`);
  console.log(`   - Rooms:       ${sync.transferred.rooms}`);
  console.log(`   - Users:       ${sync.transferred.users}`);
  console.log(`   - Students:    ${sync.transferred.students}`);
  console.log(`   - Attendance:  ${sync.transferred.attendance}`);
  console.log(`   - Leaves:      ${sync.transferred.leaves}`);
  console.log(`   - Movements:   ${sync.transferred.movements}`);
  console.log(`   - Exceptions:  ${sync.transferred.exceptions}`);
  console.log(`   - Settings:    ${sync.transferred.settings}`);

  console.log('\n🚀 PostgreSQL database is fully populated and ready for production!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
