import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import sequelize from '../config/database.js';
import { ensureDatabase } from '../config/ensureDatabase.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import Page from '../models/Page.js';
import Product from '../models/Product.js';
import RewardTransaction from '../models/RewardTransaction.js';
import Vendor from '../models/Vendor.js';
import VendorSettlement from '../models/VendorSettlement.js';
import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import { hashPassword } from '../utils/password.js';
import { ensureInvoice } from '../services/invoice.js';
dotenv.config();
const registeredModels = [RewardTransaction, Invoice];
void registeredModels;
function cleanText(value) {
    return decodeHtml((value || '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim());
}
function decodeHtml(value) {
    return (value || '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8211;/g, '-')
        .replace(/&#8212;/g, '-')
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/&#038;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}
function localUploadUrl(value) {
    if (!value) {
        return null;
    }
    return value.replace(/^https?:\/\/(?:www\.)?fuddins\.com\/wp-content\/uploads/i, '/legacy-uploads');
}
function numberOrNull(value) {
    if (value === null || typeof value === 'undefined' || value === '')
        return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}
function chunkArray(items, size = 100) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
function firstMeta(meta, key) {
    return meta.get(key)?.[0] || null;
}
async function loadLegacyProducts(connection, baseProducts) {
    const products = new Map();
    const metaByProduct = new Map();
    const imageIds = new Set();
    const imageById = new Map();
    for (const item of baseProducts) {
        products.set(item.id, {
            ...item,
            price: null,
            regularPrice: null,
            salePrice: null,
            sku: null,
            stockQuantity: null,
            stockStatus: null,
            imageUrl: null,
            galleryImageUrls: null,
            categoryName: null,
            brandName: null,
            attributes: null,
        });
        metaByProduct.set(item.id, new Map());
    }
    const productIds = baseProducts.map((item) => item.id);
    const metaKeys = ['_price', '_regular_price', '_sale_price', '_sku', '_stock', '_stock_status', '_thumbnail_id', '_product_image_gallery'];
    for (const ids of chunkArray(productIds)) {
        const [metaRows] = await connection.query(`SELECT post_id postId, meta_key metaKey, meta_value metaValue
       FROM wp_postmeta
       WHERE post_id IN (?)
         AND meta_key IN (?)`, [ids, metaKeys]);
        for (const row of metaRows) {
            const productMeta = metaByProduct.get(row.postId);
            if (!productMeta)
                continue;
            const values = productMeta.get(row.metaKey) || [];
            values.push(row.metaValue);
            productMeta.set(row.metaKey, values);
        }
        const [attributeRows] = await connection.query(`SELECT post_id postId, GROUP_CONCAT(meta_value SEPARATOR ' | ') attributes
       FROM wp_postmeta
       WHERE post_id IN (?)
         AND meta_key LIKE 'attribute_%'
       GROUP BY post_id`, [ids]);
        for (const row of attributeRows) {
            const product = products.get(row.postId);
            if (product) {
                product.attributes = row.attributes || null;
            }
        }
        const [termRows] = await connection.query(`SELECT tr.object_id productId, tt.taxonomy taxonomy, t.name name
       FROM wp_term_relationships tr
       JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
       JOIN wp_terms t ON tt.term_id = t.term_id
       WHERE tr.object_id IN (?)
         AND tt.taxonomy IN ('product_cat', 'yith_product_brand', 'product_brand')
       ORDER BY t.name`, [ids]);
        for (const row of termRows) {
            const product = products.get(row.productId);
            if (!product)
                continue;
            if (row.taxonomy === 'product_cat' && !product.categoryName) {
                product.categoryName = row.name;
            }
            if ((row.taxonomy === 'yith_product_brand' || row.taxonomy === 'product_brand') && !product.brandName) {
                product.brandName = row.name;
            }
        }
    }
    for (const [productId, productMeta] of metaByProduct.entries()) {
        const thumbnailId = numberOrNull(firstMeta(productMeta, '_thumbnail_id'));
        if (thumbnailId) {
            imageIds.add(thumbnailId);
        }
        const galleryIds = (firstMeta(productMeta, '_product_image_gallery') || '')
            .split(',')
            .map((value) => numberOrNull(value.trim()))
            .filter((value) => Boolean(value));
        for (const galleryId of galleryIds) {
            imageIds.add(galleryId);
        }
        const product = products.get(productId);
        if (!product)
            continue;
        product.price = firstMeta(productMeta, '_price');
        product.regularPrice = firstMeta(productMeta, '_regular_price');
        product.salePrice = firstMeta(productMeta, '_sale_price');
        product.sku = firstMeta(productMeta, '_sku');
        product.stockQuantity = firstMeta(productMeta, '_stock');
        product.stockStatus = firstMeta(productMeta, '_stock_status');
    }
    for (const ids of chunkArray(Array.from(imageIds))) {
        const [imageRows] = await connection.query(`SELECT ID id, guid FROM wp_posts WHERE ID IN (?)`, [ids]);
        for (const row of imageRows) {
            imageById.set(row.id, row.guid);
        }
    }
    for (const [productId, productMeta] of metaByProduct.entries()) {
        const product = products.get(productId);
        if (!product)
            continue;
        const thumbnailId = numberOrNull(firstMeta(productMeta, '_thumbnail_id'));
        product.imageUrl = thumbnailId ? imageById.get(thumbnailId) || null : null;
        product.galleryImageUrls = (firstMeta(productMeta, '_product_image_gallery') || '')
            .split(',')
            .map((value) => numberOrNull(value.trim()))
            .filter((value) => Boolean(value))
            .map((id) => imageById.get(id))
            .filter((value) => Boolean(value))
            .join(',') || null;
    }
    return Array.from(products.values());
}
async function loadLegacyProductVariations(connection, productIds) {
    const variationsByParent = new Map();
    if (!productIds.length) {
        return new Map();
    }
    for (const ids of chunkArray(productIds)) {
        const [variationRows] = await connection.query(`SELECT ID id, post_parent parentId, post_title title
       FROM wp_posts
       WHERE post_type = 'product_variation'
         AND post_status NOT IN ('trash', 'auto-draft')
         AND post_parent IN (?)`, [ids]);
        const variations = variationRows;
        if (!variations.length) {
            continue;
        }
        const variationIds = variations.map((item) => item.id);
        const metaByVariation = new Map();
        for (const variation of variations) {
            metaByVariation.set(variation.id, new Map());
        }
        for (const variationIdChunk of chunkArray(variationIds)) {
            const [metaRows] = await connection.query(`SELECT post_id postId, meta_key metaKey, meta_value metaValue
         FROM wp_postmeta
         WHERE post_id IN (?)
           AND (meta_key IN ('_price', '_regular_price', '_sale_price', '_sku', '_stock', '_stock_status')
             OR meta_key LIKE 'attribute_%')`, [variationIdChunk]);
            for (const row of metaRows) {
                metaByVariation.get(row.postId)?.set(row.metaKey, row.metaValue);
            }
        }
        for (const variation of variations) {
            const meta = metaByVariation.get(variation.id) || new Map();
            const attributes = Array.from(meta.entries())
                .filter(([key]) => key.startsWith('attribute_'))
                .reduce((result, [key, value]) => {
                const attributeName = key.replace(/^attribute_/, '').replace(/^pa_/, '').replace(/-/g, ' ');
                result[attributeName] = decodeHtml(value);
                return result;
            }, {});
            const item = {
                id: variation.id,
                parentId: variation.parentId,
                title: cleanText(variation.title),
                price: numberOrNull(meta.get('_price')),
                regularPrice: numberOrNull(meta.get('_regular_price')),
                salePrice: numberOrNull(meta.get('_sale_price')),
                sku: meta.get('_sku') || null,
                stockQuantity: numberOrNull(meta.get('_stock')),
                stockStatus: meta.get('_stock_status') || 'instock',
                attributes,
            };
            const current = variationsByParent.get(variation.parentId) || [];
            current.push(item);
            variationsByParent.set(variation.parentId, current);
        }
    }
    return new Map(Array.from(variationsByParent.entries()).map(([parentId, variations]) => [
        parentId,
        JSON.stringify(variations.sort((a, b) => a.id - b.id)),
    ]));
}
async function tableExists(connection, tableName) {
    const [rows] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
    return rows.length > 0;
}
async function tableRowCount(connection, tableName) {
    const [rows] = await connection.query(`SELECT COUNT(*) count FROM ${tableName}`);
    const [row] = rows;
    return Number(row?.count || 0);
}
async function importLegacy() {
    const legacyDb = process.env.LEGACY_DB_NAME || 'fuddinsmart_db';
    console.log(`Connecting to legacy database ${legacyDb}...`);
    const connection = await mysql.createConnection({
        host: process.env.LEGACY_DB_HOST || '127.0.0.1',
        user: process.env.LEGACY_DB_USER || 'root',
        password: process.env.LEGACY_DB_PASSWORD ?? '',
        database: legacyDb,
        connectTimeout: 10000,
    });
    console.log('Legacy database connected.');
    console.log('Connecting to modern database...');
    await ensureDatabase();
    await sequelize.authenticate();
    await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' });
    console.log('Modern database ready.');
    console.log('Importing categories...');
    const [legacyCategories] = await connection.query(`SELECT t.term_id, t.name
     FROM wp_terms t
     JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
     WHERE tt.taxonomy = 'product_cat'
     ORDER BY t.name`);
    const categoryByName = new Map();
    for (const item of legacyCategories) {
        const [category] = await Category.findOrCreate({ where: { name: item.name } });
        categoryByName.set(item.name, category);
    }
    console.log(`Categories imported: ${categoryByName.size}`);
    let importedProducts = 0;
    if (process.env.SKIP_LEGACY_PRODUCTS === 'true') {
        console.log('Skipping products because SKIP_LEGACY_PRODUCTS=true');
    }
    else {
        console.log('Loading products from legacy database...');
        const [legacyProductRows] = await connection.query(`SELECT
         p.ID id,
         p.post_title name,
         p.post_excerpt description,
         p.post_content fullDescription
       FROM wp_posts p
       WHERE p.post_status = 'publish'
         AND p.post_type = 'product'
       ORDER BY p.post_date DESC`);
        const legacyProducts = await loadLegacyProducts(connection, legacyProductRows);
        const variationsByProductId = await loadLegacyProductVariations(connection, legacyProducts.map((product) => product.id));
        console.log(`Products found: ${legacyProducts.length}`);
        for (const item of legacyProducts) {
            const price = Number(item.salePrice || item.price || item.regularPrice || 0);
            if (!item.name) {
                continue;
            }
            const category = item.categoryName ? categoryByName.get(item.categoryName) : null;
            const existing = await Product.findOne({ where: { legacyProductId: item.id } });
            const payload = {
                legacyProductId: item.id,
                name: decodeHtml(item.name),
                price,
                regularPrice: numberOrNull(item.regularPrice),
                salePrice: numberOrNull(item.salePrice),
                sku: item.sku || null,
                description: cleanText(item.description) || item.categoryName || '',
                fullDescription: cleanText(item.fullDescription),
                imageUrl: localUploadUrl(item.imageUrl),
                galleryImages: item.galleryImageUrls ? item.galleryImageUrls.split(',').map(localUploadUrl).filter(Boolean).join(',') : null,
                brand: item.brandName || null,
                stockQuantity: numberOrNull(item.stockQuantity),
                stockStatus: item.stockStatus || 'instock',
                attributes: item.attributes || null,
                variations: variationsByProductId.get(item.id) || null,
                categoryId: category?.id || null,
            };
            if (existing) {
                await existing.update(payload);
            }
            else {
                await Product.create(payload);
            }
            importedProducts += 1;
        }
        console.log(`Products imported: ${importedProducts}`);
    }
    if (process.env.SKIP_LEGACY_PRODUCTS === 'true') {
        importedProducts = await Product.count();
    }
    console.log('Importing coupons...');
    const [legacyCoupons] = await connection.query(`SELECT
       p.ID id,
       p.post_title code,
       MAX(CASE WHEN pm.meta_key = 'discount_type' THEN pm.meta_value END) discountType,
       MAX(CASE WHEN pm.meta_key = 'coupon_amount' THEN pm.meta_value END) amount,
       MAX(CASE WHEN pm.meta_key = 'usage_limit' THEN pm.meta_value END) usageLimit,
       MAX(CASE WHEN pm.meta_key = 'usage_count' THEN pm.meta_value END) usedCount,
       MAX(CASE WHEN pm.meta_key = 'date_expires' THEN pm.meta_value END) expiryDate,
       p.post_status status
     FROM wp_posts p
     LEFT JOIN wp_postmeta pm ON p.ID = pm.post_id
     WHERE p.post_type = 'shop_coupon'
     GROUP BY p.ID, p.post_title, p.post_status`);
    let importedCoupons = 0;
    for (const item of legacyCoupons) {
        if (!item.code)
            continue;
        const expirySeconds = numberOrNull(item.expiryDate);
        const payload = {
            legacyCouponId: item.id,
            code: item.code.trim().toUpperCase(),
            discountType: item.discountType || 'fixed_cart',
            amount: Number(item.amount || 0),
            usageLimit: numberOrNull(item.usageLimit),
            usedCount: Number(item.usedCount || 0),
            expiresAt: expirySeconds ? new Date(expirySeconds * 1000) : null,
            active: item.status === 'publish',
        };
        const existing = await Coupon.findOne({ where: { legacyCouponId: item.id } }) || await Coupon.findOne({ where: { code: payload.code } });
        if (existing)
            await existing.update(payload);
        else
            await Coupon.create(payload);
        importedCoupons += 1;
    }
    console.log(`Coupons imported: ${importedCoupons}`);
    console.log('Importing users...');
    const [legacyUsers] = await connection.query(`SELECT
       u.ID id,
       u.user_email email,
       u.display_name displayName,
       MAX(CASE WHEN um.meta_key = 'billing_phone' THEN um.meta_value END) phone,
       CONCAT_WS(', ',
         MAX(CASE WHEN um.meta_key = 'billing_address_1' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'billing_address_2' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'billing_city' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'billing_state' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'billing_postcode' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'billing_country' THEN um.meta_value END)
       ) billingAddress,
       CONCAT_WS(', ',
         MAX(CASE WHEN um.meta_key = 'shipping_address_1' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'shipping_address_2' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'shipping_city' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'shipping_state' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'shipping_postcode' THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key = 'shipping_country' THEN um.meta_value END)
       ) shippingAddress
     FROM wp_users u
     LEFT JOIN wp_usermeta um ON u.ID = um.user_id
     GROUP BY u.ID, u.user_email, u.display_name`);
    let importedUsers = 0;
    for (const item of legacyUsers) {
        if (!item.email)
            continue;
        const payload = {
            legacyUserId: item.id,
            name: item.displayName || item.email.split('@')[0],
            email: item.email.trim().toLowerCase(),
            password: hashPassword(`legacy-${item.id}-${Date.now()}`),
            role: 'user',
            phone: item.phone || null,
            billingAddress: item.billingAddress || null,
            shippingAddress: item.shippingAddress || null,
        };
        const existing = await User.findOne({ where: { legacyUserId: item.id } }) || await User.findOne({ where: { email: payload.email } });
        if (existing)
            await existing.update({ legacyUserId: payload.legacyUserId, name: payload.name, phone: payload.phone, billingAddress: payload.billingAddress, shippingAddress: payload.shippingAddress });
        else
            await User.create(payload);
        importedUsers += 1;
    }
    console.log(`Users imported: ${importedUsers}`);
    console.log('Importing wallet balances...');
    const [legacyWalletBalances] = await connection.query(`SELECT user_id userId, meta_value balance
     FROM wp_usermeta
     WHERE meta_key = '_current_woo_wallet_balance'`);
    let importedWallets = 0;
    for (const item of legacyWalletBalances) {
        const balance = Number(item.balance || 0);
        if (!balance)
            continue;
        const user = await User.findOne({ where: { legacyUserId: item.userId } });
        const existing = await WalletTransaction.findOne({ where: { legacyUserId: item.userId, type: 'legacy_balance' } });
        const payload = {
            userId: user?.id || null,
            legacyUserId: item.userId,
            type: 'legacy_balance',
            amount: balance,
            balanceAfter: balance,
            description: 'Imported Woo Wallet balance',
            status: 'completed',
        };
        if (existing)
            await existing.update(payload);
        else
            await WalletTransaction.create(payload);
        importedWallets += 1;
    }
    console.log(`Wallet balances imported: ${importedWallets}`);
    console.log('Importing vendors...');
    const [legacyVendors] = await connection.query(`SELECT
       u.ID id,
       u.user_email email,
       u.display_name displayName,
       MAX(CASE WHEN um.meta_key = 'wcfmmp_store_name' THEN um.meta_value END) storeName,
       MAX(CASE WHEN um.meta_key IN ('billing_phone', '_wcfm_phone') THEN um.meta_value END) phone,
       CONCAT_WS(', ',
         MAX(CASE WHEN um.meta_key IN ('_wcfm_street_1', '_wcfm_billing_address_1') THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key IN ('_wcfm_street_2', '_wcfm_billing_address_2') THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key IN ('_wcfm_city', '_wcfm_billing_city') THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key IN ('_wcfm_state', '_wcfm_billing_state') THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key IN ('_wcfm_zip', '_wcfm_billing_postcode') THEN um.meta_value END),
         MAX(CASE WHEN um.meta_key IN ('_wcfm_country', '_wcfm_billing_country') THEN um.meta_value END)
       ) address,
       MAX(CASE WHEN um.meta_key = 'wcfmmp_profile_settings' THEN um.meta_value END) profile,
       MAX(CASE WHEN um.meta_key = 'wcfm_subscription_status' THEN um.meta_value END) status
     FROM wp_users u
     JOIN wp_usermeta vendorMeta ON u.ID = vendorMeta.user_id AND vendorMeta.meta_key = 'wcfmmp_store_name'
     LEFT JOIN wp_usermeta um ON u.ID = um.user_id
     GROUP BY u.ID, u.user_email, u.display_name`);
    let importedVendors = 0;
    for (const item of legacyVendors) {
        const user = await User.findOne({ where: { legacyUserId: item.id } });
        const payload = {
            userId: user?.id || null,
            legacyVendorId: item.id,
            storeName: cleanText(item.storeName || item.displayName || item.email),
            email: item.email?.trim().toLowerCase() || null,
            phone: item.phone || null,
            address: item.address || null,
            status: item.status || 'active',
            profile: item.profile || null,
        };
        const existing = await Vendor.findOne({ where: { legacyVendorId: item.id } });
        if (existing)
            await existing.update(payload);
        else
            await Vendor.create(payload);
        importedVendors += 1;
    }
    console.log(`Vendors imported: ${importedVendors}`);
    // WCFM stores ownership on the WordPress product author. Link imported
    // products to their modern vendor after both datasets are available.
    const [legacyProductOwners] = await connection.query(`SELECT ID id, post_author authorId
     FROM wp_posts
     WHERE post_type = 'product'
       AND post_status NOT IN ('trash', 'auto-draft')`);
    let linkedVendorProducts = 0;
    for (const item of legacyProductOwners) {
        if (!item.authorId)
            continue;
        const vendor = await Vendor.findOne({ where: { legacyVendorId: item.authorId } });
        if (!vendor)
            continue;
        const product = await Product.findOne({ where: { legacyProductId: item.id } });
        if (!product || product.vendorId === vendor.id)
            continue;
        await product.update({ vendorId: vendor.id });
        linkedVendorProducts += 1;
    }
    console.log(`Vendor products linked: ${linkedVendorProducts}`);
    console.log('Importing orders...');
    let legacyOrders = [];
    const hasHposOrders = await tableExists(connection, 'wp_wc_orders');
    const hposOrderCount = hasHposOrders ? await tableRowCount(connection, 'wp_wc_orders') : 0;
    if (hposOrderCount > 0) {
        const [orderRows] = await connection.query(`SELECT
         o.id id,
         o.status status,
         CONCAT_WS(' ', billing.first_name, billing.last_name) customerName,
         COALESCE(billing.email, o.billing_email) email,
         billing.phone phone,
         o.total_amount total,
         COALESCE((SELECT SUM(coupon.discount_amount) FROM wp_wc_order_coupon_lookup coupon WHERE coupon.order_id = o.id), 0) discountTotal,
         COALESCE((SELECT SUM(product.shipping_amount) FROM wp_wc_order_product_lookup product WHERE product.order_id = o.id), 0) shippingTotal,
         o.tax_amount taxTotal,
         o.payment_method paymentMethod,
         CASE WHEN o.status IN ('wc-completed', 'wc-processing') THEN 'paid' ELSE 'pending' END paymentStatus,
         CONCAT_WS(', ', billing.address_1, billing.address_2, billing.city, billing.state, billing.postcode, billing.country) billingAddress,
         CONCAT_WS(', ', shipping.address_1, shipping.address_2, shipping.city, shipping.state, shipping.postcode, shipping.country) shippingAddress,
         (SELECT GROUP_CONCAT(CONCAT(COALESCE(productPost.post_title, CONCAT('Product #', product.product_id)), ' x ', product.product_qty) SEPARATOR ', ')
          FROM wp_wc_order_product_lookup product
          LEFT JOIN wp_posts productPost ON productPost.ID = product.product_id
          WHERE product.order_id = o.id) items,
         (SELECT GROUP_CONCAT(couponPost.post_title SEPARATOR ',')
          FROM wp_wc_order_coupon_lookup coupon
          LEFT JOIN wp_posts couponPost ON couponPost.ID = coupon.coupon_id
          WHERE coupon.order_id = o.id) couponCode
       FROM wp_wc_orders o
       LEFT JOIN wp_wc_order_addresses billing ON billing.order_id = o.id AND billing.address_type = 'billing'
       LEFT JOIN wp_wc_order_addresses shipping ON shipping.order_id = o.id AND shipping.address_type = 'shipping'
       WHERE o.type = 'shop_order'
       ORDER BY o.date_created_gmt DESC`);
        legacyOrders = orderRows;
    }
    else {
        const hasOrderItems = await tableExists(connection, 'wp_woocommerce_order_items');
        const itemFields = hasOrderItems
            ? `(SELECT GROUP_CONCAT(CONCAT(oi.order_item_name, ' x ', COALESCE(qty.meta_value, 1)) SEPARATOR ', ')
          FROM wp_woocommerce_order_items oi
          LEFT JOIN wp_woocommerce_order_itemmeta qty ON oi.order_item_id = qty.order_item_id AND qty.meta_key = '_qty'
          WHERE oi.order_id = p.ID AND oi.order_item_type = 'line_item') items,
         (SELECT GROUP_CONCAT(coupon.order_item_name SEPARATOR ',')
          FROM wp_woocommerce_order_items coupon
          WHERE coupon.order_id = p.ID AND coupon.order_item_type = 'coupon') couponCode`
            : `NULL items, NULL couponCode`;
        const [orderRows] = await connection.query(`SELECT
         p.ID id,
         p.post_status status,
         CONCAT_WS(' ',
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_first_name' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_last_name' LIMIT 1)
         ) customerName,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_email' LIMIT 1) email,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_phone' LIMIT 1) phone,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_order_total' LIMIT 1) total,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_cart_discount' LIMIT 1) discountTotal,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_order_shipping' LIMIT 1) shippingTotal,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_order_tax' LIMIT 1) taxTotal,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_payment_method' LIMIT 1) paymentMethod,
         (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_paid_date' LIMIT 1) paymentStatus,
         CONCAT_WS(', ',
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_address_1' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_address_2' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_city' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_state' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_postcode' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_billing_country' LIMIT 1)
         ) billingAddress,
         CONCAT_WS(', ',
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_shipping_address_1' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_shipping_address_2' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_shipping_city' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_shipping_state' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_shipping_postcode' LIMIT 1),
           (SELECT meta_value FROM wp_postmeta WHERE post_id = p.ID AND meta_key = '_shipping_country' LIMIT 1)
         ) shippingAddress,
         ${itemFields}
       FROM wp_posts p
       WHERE p.post_type = 'shop_order'
       ORDER BY p.post_date DESC`);
        legacyOrders = orderRows;
    }
    let importedOrders = 0;
    console.log(`Orders found: ${legacyOrders.length}`);
    for (const item of legacyOrders) {
        const email = item.email?.trim().toLowerCase() || `legacy-order-${item.id}@legacy.local`;
        const total = Number(item.total || 0);
        const discountTotal = numberOrNull(item.discountTotal) || 0;
        const shippingTotal = numberOrNull(item.shippingTotal) || 0;
        const taxTotal = numberOrNull(item.taxTotal) || 0;
        const subtotal = Math.max(total + discountTotal - shippingTotal - taxTotal, 0);
        const payload = {
            legacyOrderId: item.id,
            customerName: cleanText(item.customerName) || email.split('@')[0],
            email,
            phone: item.phone || null,
            total,
            subtotal,
            discountTotal,
            shippingTotal,
            taxTotal,
            items: JSON.stringify((item.items || '').split(', ').filter(Boolean).map((line) => ({ name: line, quantity: 1 }))),
            status: item.status?.replace(/^wc-/, '') || 'pending',
            couponCode: item.couponCode || null,
            billingAddress: item.billingAddress || null,
            shippingAddress: item.shippingAddress || null,
            paymentMethod: item.paymentMethod || 'legacy',
            paymentStatus: item.paymentStatus ? 'paid' : item.status === 'wc-completed' ? 'paid' : 'pending',
        };
        const existing = await Order.findOne({ where: { legacyOrderId: item.id } });
        const order = existing ? await existing.update(payload) : await Order.create(payload);
        await ensureInvoice(order);
        importedOrders += 1;
    }
    console.log(`Orders imported: ${importedOrders}`);
    console.log('Importing vendor settlements...');
    let importedSettlements = 0;
    if (await tableExists(connection, 'wp_dokan_vendor_balance')) {
        const [legacyVendorBalances] = await connection.query(`SELECT
         id,
         vendor_id legacyVendorId,
         trn_id transactionId,
         trn_type transactionType,
         perticulars notes,
         debit,
         credit,
         status,
         trn_date transactionDate
       FROM wp_dokan_vendor_balance
       ORDER BY id`);
        for (const item of legacyVendorBalances) {
            const vendor = await Vendor.findOne({ where: { legacyVendorId: item.legacyVendorId } });
            const credit = Number(item.credit || 0);
            const debit = Number(item.debit || 0);
            const netAmount = credit - debit;
            const existing = await VendorSettlement.findOne({ where: { legacyVendorId: item.legacyVendorId, transactionId: item.transactionId || String(item.id) } });
            const payload = {
                vendorId: vendor?.id || null,
                legacyVendorId: item.legacyVendorId,
                orderId: null,
                legacyOrderId: null,
                transactionId: item.transactionId || String(item.id),
                transactionType: item.transactionType || 'legacy_balance',
                grossAmount: credit,
                commissionAmount: debit,
                netAmount,
                paidAmount: item.status === 'approved' || item.status === 'paid' ? netAmount : 0,
                status: item.status || 'pending',
                notes: item.notes || null,
                settledAt: item.status === 'approved' || item.status === 'paid' ? item.transactionDate : null,
            };
            if (existing)
                await existing.update(payload);
            else
                await VendorSettlement.create(payload);
            importedSettlements += 1;
        }
    }
    if (await tableExists(connection, 'wp_dokan_orders')) {
        const [legacyDokanOrders] = await connection.query(`SELECT id, order_id orderId, seller_id sellerId, order_total orderTotal, net_amount netAmount, order_status orderStatus
       FROM wp_dokan_orders
       ORDER BY id`);
        for (const item of legacyDokanOrders) {
            const vendor = await Vendor.findOne({ where: { legacyVendorId: item.sellerId } });
            const order = await Order.findOne({ where: { legacyOrderId: item.orderId } });
            const netAmount = Number(item.netAmount || 0);
            const grossAmount = Number(item.orderTotal || netAmount);
            const transactionId = `dokan-order-${item.id}`;
            const existing = await VendorSettlement.findOne({ where: { legacyVendorId: item.sellerId, transactionId } });
            const payload = {
                vendorId: vendor?.id || null,
                legacyVendorId: item.sellerId,
                orderId: order?.id || null,
                legacyOrderId: item.orderId,
                transactionId,
                transactionType: 'order_commission',
                grossAmount,
                commissionAmount: Math.max(grossAmount - netAmount, 0),
                netAmount,
                paidAmount: 0,
                status: item.orderStatus || 'pending',
                notes: `Imported Dokan order settlement for legacy order #${item.orderId}`,
                settledAt: null,
            };
            if (existing)
                await existing.update(payload);
            else
                await VendorSettlement.create(payload);
            importedSettlements += 1;
        }
    }
    console.log(`Vendor settlements imported: ${importedSettlements}`);
    console.log('Importing pages...');
    const [legacyPages] = await connection.query(`SELECT post_name slug, post_title title, post_content content
     FROM wp_posts
     WHERE post_status = 'publish'
       AND post_type = 'page'
       AND post_name <> ''
     ORDER BY menu_order ASC, post_title ASC`);
    let importedPages = 0;
    for (const item of legacyPages) {
        const content = cleanText(item.content);
        if (!item.slug || !item.title || !content) {
            continue;
        }
        const [page, created] = await Page.findOrCreate({
            where: { slug: item.slug },
            defaults: {
                title: item.title,
                content,
            },
        });
        if (!created) {
            await page.update({ title: item.title, content });
        }
        importedPages += 1;
    }
    await connection.end();
    await sequelize.close();
    console.log(`Imported ${categoryByName.size} categories, ${importedProducts} products, ${importedCoupons} coupons, ${importedUsers} users, ${importedOrders} orders, ${importedWallets} wallet balances, ${importedVendors} vendors, ${importedSettlements} vendor settlements, and ${importedPages} pages from ${legacyDb}`);
}
importLegacy().catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
});
