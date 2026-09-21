import { sequelize } from '../models/sequelize-instance.js';
import Vendor from '../models/Vendor.js';

async function run() {
  await sequelize.authenticate();
  await Vendor.sync({ alter: true });
  console.log('Vendor store setup columns are ready');
  await sequelize.close();
}

run().catch((error) => { console.error('Unable to migrate vendor store setup:', error); process.exitCode = 1; });
