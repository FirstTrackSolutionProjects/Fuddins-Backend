'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('invoices', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      // Orders are created by the next migration in timestamp order, so the
      // relationship is enforced by the Sequelize model association instead
      // of referencing a table that does not exist yet during this migration.
      orderId: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      invoiceNumber: { type: Sequelize.STRING, allowNull: false, unique: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'issued' },
      issuedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('invoices');
  }
};
