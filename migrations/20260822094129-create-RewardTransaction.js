'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('reward_transactions', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      // The users table is created by the next migration in timestamp order;
      // keep this column nullable here and enforce the association in the model.
      userId: { type: Sequelize.INTEGER, allowNull: true },
      legacyUserId: { type: Sequelize.INTEGER, allowNull: true },
      orderId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'orders', key: 'id' } },
      type: { type: Sequelize.STRING, allowNull: false },
      points: { type: Sequelize.INTEGER, allowNull: false },
      balanceAfter: { type: Sequelize.INTEGER, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'completed' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('reward_transactions');
  }
};
