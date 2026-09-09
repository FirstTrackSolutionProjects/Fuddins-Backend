'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('vendor_notices', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      vendorId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'vendors', key: 'id' } },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'notice' },
      readAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('vendor_notices');
  }
};
