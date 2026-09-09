'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.some((table) => {
      const name = typeof table === 'string' ? table : table.tableName;
      return String(name).toLowerCase() === 'vendor_settlements';
    });

    if (!tableExists) {
      await queryInterface.createTable('vendor_settlements', {
        id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
        vendorId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'vendors', key: 'id' } },
        legacyVendorId: { type: Sequelize.INTEGER, allowNull: true },
        orderId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'orders', key: 'id' } },
        legacyOrderId: { type: Sequelize.INTEGER, allowNull: true },
        transactionId: { type: Sequelize.STRING, allowNull: true },
        transactionType: { type: Sequelize.STRING, allowNull: false, defaultValue: 'commission' },
        grossAmount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        commissionAmount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        netAmount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        paidAmount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
        notes: { type: Sequelize.TEXT, allowNull: true },
        settledAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }

    const indexes = await queryInterface.showIndex('vendor_settlements');
    const indexExists = indexes.some((index) => index.name === 'uniq_vendor_legacy_txn');
    if (!indexExists) {
      await queryInterface.addIndex('vendor_settlements', ['legacyVendorId', 'legacyOrderId', 'transactionId'], {
        name: 'uniq_vendor_legacy_txn',
        unique: true,
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('vendor_settlements');
  }
};
