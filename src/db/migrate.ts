import { createDatabase } from './database.js';

const db = createDatabase();
db.close();
console.log('Database migration complete.');
