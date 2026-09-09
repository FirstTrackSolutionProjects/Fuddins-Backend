'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('coupons', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      legacyCouponId: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      discountType: { type: Sequelize.STRING, allowNull: false, defaultValue: 'fixed_cart' },
      amount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      usageLimit: { type: Sequelize.INTEGER, allowNull: true },
      usedCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      expiresAt: { type: Sequelize.DATE, allowNull: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('coupons');
  }
};
