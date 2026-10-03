import postgres from 'postgres';
const sql = postgres('postgresql://postgres.suhjevptsrlyubsezhzj:Wancak123%3F%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres', { max: 1 });
const result = await sql.unsafe('SELECT table_name FROM information_schema.tables WHERE table_schema = ' + "'public'" + ' AND table_type = ' + "'BASE TABLE'" + ' ORDER BY table_name');
console.log('Existing tables:', result.length);
result.forEach(r => console.log(' -', r.table_name));
await sql.end();