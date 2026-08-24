const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const useSsl = process.env.DB_SSL === 'true';

const connection = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ftech_db',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
};

if (useSsl) {
  connection.dialectOptions = {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  };
}

module.exports = {
  development: connection,
  test: { ...connection, database: process.env.DB_TEST_NAME || `${connection.database}_test` },
  production: connection,
};
