'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('vendors', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      userId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      legacyVendorId: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      storeName: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      profile: { type: Sequelize.TEXT, allowNull: true },
      businessHours: { type: Sequelize.STRING, allowNull: true },
      acceptingOrders: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      minimumOrderAmount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      deliveryRadius: { type: Sequelize.FLOAT, allowNull: true },
      membershipPlan: { type: Sequelize.STRING, allowNull: false, defaultValue: 'Standard' },
      membershipStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      membershipFee: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      membershipPaymentStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'unpaid' },
      membershipStartedAt: { type: Sequelize.DATE, allowNull: true },
      membershipExpiresAt: { type: Sequelize.DATE, allowNull: true },
      membershipPaymentLinkId: { type: Sequelize.STRING, allowNull: true },
      membershipPaymentId: { type: Sequelize.STRING, allowNull: true },
      payoutMethod: { type: Sequelize.STRING, allowNull: false, defaultValue: 'upi' },
      payoutAccountName: { type: Sequelize.STRING, allowNull: true },
      payoutAccountNumber: { type: Sequelize.STRING, allowNull: true },
      payoutIfsc: { type: Sequelize.STRING, allowNull: true },
      payoutUpi: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('products', {
      fields: ['vendorId'],
      type: 'foreign key',
      name: 'products_vendor_id_fk',
      references: { table: 'vendors', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('products', 'products_vendor_id_fk');
    await queryInterface.dropTable('vendors');
  }
};
