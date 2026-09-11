import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import databaseConfig from '../../config/config.json' with { type: 'json' };
import { sequelize } from '../models/index.js';
import Product from '../models/Product.js';
import Vendor from '../models/Vendor.js';

dotenv.config();

type LegacyProductOwner = { id: number; authorId: number };

/** Repairs only missing or stale legacy product-to-vendor links. */
async function linkLegacyProductVendors() {
  const developmentConfig = databaseConfig.development;
  const legacyDb = process.env.LEGACY_DB_NAME || 'fuddinsmart_db';
  const legacyConnection = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST || developmentConfig.host || '127.0.0.1',
    user: process.env.LEGACY_DB_USER || developmentConfig.username || 'root',
    // A dedicated LEGACY_DB_PASSWORD wins; local development otherwise uses
    // the already-configured MySQL credential without ever logging it.
    password: process.env.LEGACY_DB_PASSWORD ?? developmentConfig.password ?? '',
    database: legacyDb,
    connectTimeout: 10000,
  });

  try {
    await sequelize.authenticate();
    const [legacyOwners] = await legacyConnection.query(
      `SELECT ID id, post_author authorId
       FROM wp_posts
       WHERE post_type = 'product'
         AND post_status NOT IN ('trash', 'auto-draft')`
    );
    const [vendors, products] = await Promise.all([
      Vendor.findAll({ attributes: ['id', 'legacyVendorId'] }),
      Product.findAll({ attributes: ['id', 'legacyProductId', 'vendorId'] }),
    ]);

    const vendorsByLegacyId = new Map<number, number>();
    const validVendorIds = new Set<number>();
    for (const vendor of vendors) {
      validVendorIds.add(vendor.id);
      if (vendor.legacyVendorId) vendorsByLegacyId.set(vendor.legacyVendorId, vendor.id);
    }
    const ownerByLegacyProductId = new Map<number, number>();
    for (const owner of legacyOwners as LegacyProductOwner[]) {
      if (owner.authorId) ownerByLegacyProductId.set(owner.id, owner.authorId);
    }

    let repaired = 0;
    let alreadyValid = 0;
    let skippedWithoutLegacyOwner = 0;
    let skippedWithoutVendor = 0;
    for (const product of products) {
      if (!product.legacyProductId) continue;
      // Existing modern vendor assignments are deliberately preserved.
      if (product.vendorId && validVendorIds.has(product.vendorId)) {
        alreadyValid += 1;
        continue;
      }
      const legacyAuthorId = ownerByLegacyProductId.get(product.legacyProductId);
      if (!legacyAuthorId) {
        skippedWithoutLegacyOwner += 1;
        continue;
      }
      const vendorId = vendorsByLegacyId.get(legacyAuthorId);
      if (!vendorId) {
        skippedWithoutVendor += 1;
        continue;
      }
      if (product.vendorId !== vendorId) {
        await product.update({ vendorId });
        repaired += 1;
      }
    }

    console.log(JSON.stringify({
      legacyDatabase: legacyDb,
      legacyProductOwners: ownerByLegacyProductId.size,
      modernProductsChecked: products.length,
      validVendorLinksKept: alreadyValid,
      productVendorLinksRepaired: repaired,
      skippedWithoutLegacyOwner,
      skippedWithoutMatchingVendor: skippedWithoutVendor,
    }, null, 2));
  } finally {
    await legacyConnection.end();
    await sequelize.close();
  }
}

linkLegacyProductVendors().catch((error) => {
  console.error('Targeted product/vendor mapping failed:', error);
  process.exitCode = 1;
});
