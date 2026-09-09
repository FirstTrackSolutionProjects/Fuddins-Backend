'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('vendor_payout_requests', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      vendorId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'vendors', key: 'id' } },
      amount: { type: Sequelize.FLOAT, allowNull: false },
      method: { type: Sequelize.STRING, allowNull: false, defaultValue: 'upi' },
      accountSnapshot: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'requested' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      processedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('vendor_payout_requests');
  }
};
