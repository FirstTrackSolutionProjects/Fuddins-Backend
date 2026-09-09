'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      legacyUserId: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, allowNull: false, defaultValue: 'user' },
      phone: { type: Sequelize.STRING, allowNull: true },
      billingAddress: { type: Sequelize.TEXT, allowNull: true },
      shippingAddress: { type: Sequelize.TEXT, allowNull: true },
      deliveryVehicleType: { type: Sequelize.STRING, allowNull: true },
      deliveryVehicleNumber: { type: Sequelize.STRING, allowNull: true },
      deliveryStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'offline' },
      deliveryLastSeenAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('reward_transactions', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'reward_transactions_user_id_fk',
      references: { table: 'users', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('reward_transactions', 'reward_transactions_user_id_fk');
    await queryInterface.dropTable('users');
  }
};
