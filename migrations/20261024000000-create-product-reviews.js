'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_reviews', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      productId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      reviewerName: { type: Sequelize.STRING, allowNull: false },
      rating: { type: Sequelize.INTEGER, allowNull: false },
      review: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('product_reviews', ['productId', 'userId'], { unique: true, name: 'product_reviews_product_user_unique' });
    await queryInterface.addIndex('product_reviews', ['productId', 'status'], { name: 'product_reviews_product_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_reviews');
  },
};
