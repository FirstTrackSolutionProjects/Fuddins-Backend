import { sequelize } from '../models/sequelize-instance.js';
import User from '../models/User.js';

async function run() {
  await sequelize.authenticate();
  await User.sync({ alter: true });
  console.log('User notification preferences column is ready');
  await sequelize.close();
}

run().catch((error) => { console.error('Unable to migrate user notification preferences:', error); process.exitCode = 1; });
