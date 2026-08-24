'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('wallet_transactions', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      userId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      legacyUserId: { type: Sequelize.INTEGER, allowNull: true },
      orderId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'orders', key: 'id' } },
      type: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.FLOAT, allowNull: false },
      balanceAfter: { type: Sequelize.FLOAT, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'completed' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('wallet_transactions');
  }
};
