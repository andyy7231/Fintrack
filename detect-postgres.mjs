import postgres from 'postgres';

async function detectPostgreSQL() {
  console.log('[Detection] Attempting to detect local PostgreSQL...');
  
  const testConfigs = [
    { host: 'localhost', port: 5432, user: 'postgres', database: 'postgres' },
    { host: '127.0.0.1', port: 5432, user: 'postgres', database: 'postgres' },
  ];

  for (const config of testConfigs) {
    try {
      console.log(`[Detection] Trying ${config.host}:${config.port} as user ${config.user}...`);
      
      const sql = postgres({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        // Try common default passwords or no password
        password: '',
        max: 1,
        connect_timeout: 3,
        idle_timeout: 1,
      });

      const result = await sql`SELECT version()`;
      console.log(`[Detection] ✅ PostgreSQL detected: ${result[0].version}`);
      
      await sql.end();
      
      return {
        available: true,
        host: config.host,
        port: config.port,
        user: config.user,
        version: result[0].version,
      };
    } catch (error) {
      console.log(`[Detection] ❌ Connection failed: ${error.message}`);
    }
  }

  return { available: false };
}

detectPostgreSQL().then(result => {
  console.log('[Detection] Final result:', JSON.stringify(result, null, 2));
  process.exit(result.available ? 0 : 1);
}).catch(err => {
  console.error('[Detection] Fatal error:', err);
  process.exit(1);
});
