import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { checkDB } from './config/db';

const PORT = parseInt(process.env.PORT || '3001');

async function main() {
  await checkDB();

  app.listen(PORT, () => {
    console.log(`\n Router Backend running on http://localhost:${PORT}`);
    console.log(`   ├── GET  /locations`);
    console.log(`   ├── GET  /locations/map?north=&south=&east=&west=`);
    console.log(`   ├── GET  /locations/clusters`);
    console.log(`   ├── GET  /locations/:id`);
    console.log(`   └── GET  /regions\n`);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received — shutting down...');
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});