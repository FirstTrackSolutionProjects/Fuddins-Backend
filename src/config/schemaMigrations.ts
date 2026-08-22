import { QueryTypes } from 'sequelize';
import sequelize from './database.js';

type ColumnDefinition = { name: string; sql: string };

/**
 * Small, idempotent production-safe migrations for columns added after the
 * original WordPress import. Production deliberately keeps sequelize.sync
 * alter disabled, so these checks run on every boot and only add missing
 * columns. Existing data is never removed or rewritten.
 */
async function addMissingColumns(table: string, columns: ColumnDefinition[]) {
  const existing = await sequelize.query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [table], type: QueryTypes.SELECT },
  );
  const existingNames = new Set(existing.map((column) => column.COLUMN_NAME));

  for (const column of columns) {
    if (existingNames.has(column.name)) continue;
    await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column.name}\` ${column.sql}`);
    console.log(`Schema migration: added ${table}.${column.name}`);
  }
}

export async function ensureCurrentSchema() {
  // Vendor ownership was added after the original product import. The
  // production database may still have the old `products` table, and any
  // product query that includes the vendor relation will fail until this
  // nullable column exists.
  await addMissingColumns('products', [
    { name: 'vendorId', sql: 'INT NULL' },
  ]);

  await addMissingColumns('users', [
    { name: 'deliveryVehicleType', sql: 'VARCHAR(255) NULL' },
    { name: 'deliveryVehicleNumber', sql: 'VARCHAR(255) NULL' },
    { name: 'deliveryStatus', sql: "VARCHAR(255) NOT NULL DEFAULT 'offline'" },
    { name: 'deliveryLastSeenAt', sql: 'DATETIME NULL' },
  ]);

  await addMissingColumns('orders', [
    { name: 'deliveryUserId', sql: 'INT NULL' },
    { name: 'deliveryStatus', sql: "VARCHAR(255) NOT NULL DEFAULT 'unassigned'" },
    { name: 'deliveredAt', sql: 'DATETIME NULL' },
    { name: 'deliveryNote', sql: 'TEXT NULL' },
    { name: 'trackingCode', sql: 'VARCHAR(255) NULL' },
    { name: 'trackingUrl', sql: 'TEXT NULL' },
  ]);
}
