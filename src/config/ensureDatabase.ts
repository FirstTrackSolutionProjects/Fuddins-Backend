import mysql from 'mysql2/promise';

export async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME ?? 'ftech_db'}\``);
  await connection.end();
}
