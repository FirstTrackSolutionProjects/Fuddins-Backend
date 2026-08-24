'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      legacyProductId: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      price: { type: Sequelize.FLOAT, allowNull: false },
      regularPrice: { type: Sequelize.FLOAT, allowNull: true },
      salePrice: { type: Sequelize.FLOAT, allowNull: true },
      sku: { type: Sequelize.STRING, allowNull: true, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      fullDescription: { type: Sequelize.TEXT, allowNull: true },
      imageUrl: { type: Sequelize.STRING, allowNull: true },
      galleryImages: { type: Sequelize.TEXT, allowNull: true },
      brand: { type: Sequelize.STRING, allowNull: true },
      stockQuantity: { type: Sequelize.INTEGER, allowNull: true },
      stockStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'instock' },
      attributes: { type: Sequelize.TEXT, allowNull: true },
      variations: { type: Sequelize.TEXT, allowNull: true },
      categoryId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'categories', key: 'id' } },
      vendorId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('products');
  }
};
