import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { sequelize } from '../models/index.js';
import Product from '../models/Product.js';
import Vendor from '../models/Vendor.js';

dotenv.config();

type LegacyVendor = {
  id: number;
  storeName: string | null;
  status: string | null;
};

type LegacyProductOwner = { id: number; authorId: number };

function cleanStoreName(value?: string | null) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#8217;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function importLegacyVendors() {
  // This script is called during deployment builds, but runs only for the
  // explicitly approved one-time vendor migration.
  if (process.env.LEGACY_IMPORT_VENDORS_ON_BUILD !== 'true') {
    console.log('Skipping legacy vendor import; LEGACY_IMPORT_VENDORS_ON_BUILD is not true.');
    return;
  }

  const legacyDb = process.env.LEGACY_DB_NAME || 'fuddinsmart_db';
  const connection = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST || '127.0.0.1',
    user: process.env.LEGACY_DB_USER || 'root',
    password: process.env.LEGACY_DB_PASSWORD ?? '',
    database: legacyDb,
    connectTimeout: 10000,
  });

  try {
    await sequelize.authenticate();
    const [legacyVendorRows] = await connection.query(
      `SELECT u.ID id,
              MAX(CASE WHEN um.meta_key = 'wcfmmp_store_name' THEN um.meta_value END) storeName,
              MAX(CASE WHEN um.meta_key = 'wcfm_subscription_status' THEN um.meta_value END) status
       FROM wp_users u
       JOIN wp_usermeta storeMeta
         ON storeMeta.user_id = u.ID
        AND storeMeta.meta_key = 'wcfmmp_store_name'
       LEFT JOIN wp_usermeta um ON um.user_id = u.ID
       GROUP BY u.ID
       HAVING storeName IS NOT NULL AND TRIM(storeName) <> ''`
    );

    const legacyVendors = legacyVendorRows as LegacyVendor[];
    const vendorIdByLegacyId = new Map<number, number>();
    let vendorsCreated = 0;
    let vendorNamesUpdated = 0;

    for (const row of legacyVendors) {
      const storeName = cleanStoreName(row.storeName);
      if (!storeName) continue;

      const [vendor, created] = await Vendor.findOrCreate({
        where: { legacyVendorId: row.id },
        defaults: {
          legacyVendorId: row.id,
          storeName,
          status: row.status || 'active',
        },
      });
      if (created) {
        vendorsCreated += 1;
      } else if (vendor.storeName !== storeName) {
        await vendor.update({ storeName });
        vendorNamesUpdated += 1;
      }
      vendorIdByLegacyId.set(row.id, vendor.id);
    }

    const [ownerRows] = await connection.query(
      `SELECT ID id, post_author authorId
       FROM wp_posts
       WHERE post_type = 'product'
         AND post_status NOT IN ('trash', 'auto-draft')`
    );
    const ownerByProductId = new Map<number, number>();
    for (const owner of ownerRows as LegacyProductOwner[]) {
      if (owner.authorId) ownerByProductId.set(owner.id, owner.authorId);
    }

    const [products, existingVendors] = await Promise.all([
      Product.findAll({ attributes: ['id', 'legacyProductId', 'vendorId'] }),
      Vendor.findAll({ attributes: ['id'] }),
    ]);
    const validVendorIds = new Set(existingVendors.map((vendor) => vendor.id));
    let productLinksCreated = 0;
    let productsWithoutVendor = 0;

    for (const product of products) {
      if (!product.legacyProductId) continue;
      // Keep any valid vendor assignment made in the modern app.
      if (product.vendorId && validVendorIds.has(product.vendorId)) continue;

      const legacyOwnerId = ownerByProductId.get(product.legacyProductId);
      const vendorId = legacyOwnerId ? vendorIdByLegacyId.get(legacyOwnerId) : undefined;
      if (!vendorId) {
        productsWithoutVendor += 1;
        continue;
      }
      await product.update({ vendorId });
      productLinksCreated += 1;
    }

    console.log(JSON.stringify({
      legacyDatabase: legacyDb,
      legacyVendorRows: legacyVendors.length,
      vendorsCreated,
      vendorNamesUpdated,
      productLinksCreated,
      productsWithoutVendor,
    }, null, 2));
  } finally {
    await connection.end();
    await sequelize.close();
  }
}

importLegacyVendors().catch((error) => {
  console.error('Legacy vendor import failed:', error);
  process.exitCode = 1;
});
