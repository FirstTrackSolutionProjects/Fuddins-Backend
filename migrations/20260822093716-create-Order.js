'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      legacyOrderId: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      customerName: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false },
      total: { type: Sequelize.FLOAT, allowNull: false },
      subtotal: { type: Sequelize.FLOAT, allowNull: true },
      discountTotal: { type: Sequelize.FLOAT, allowNull: true },
      shippingTotal: { type: Sequelize.FLOAT, allowNull: true },
      taxTotal: { type: Sequelize.FLOAT, allowNull: true },
      items: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      couponCode: { type: Sequelize.STRING, allowNull: true },
      billingAddress: { type: Sequelize.TEXT, allowNull: true },
      shippingAddress: { type: Sequelize.TEXT, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      paymentMethod: { type: Sequelize.STRING, allowNull: false, defaultValue: 'cod' },
      paymentStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      paymentProvider: { type: Sequelize.STRING, allowNull: true },
      paymentLinkId: { type: Sequelize.STRING, allowNull: true, unique: true },
      paymentId: { type: Sequelize.STRING, allowNull: true },
      deliveryUserId: { type: Sequelize.INTEGER, allowNull: true },
      deliveryStatus: { type: Sequelize.STRING, allowNull: false, defaultValue: 'unassigned' },
      deliveredAt: { type: Sequelize.DATE, allowNull: true },
      deliveryNote: { type: Sequelize.TEXT, allowNull: true },
      trackingCode: { type: Sequelize.STRING, allowNull: true },
      trackingUrl: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('invoices', {
      fields: ['orderId'],
      type: 'foreign key',
      name: 'invoices_order_id_fk',
      references: { table: 'orders', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('invoices', 'invoices_order_id_fk');
    await queryInterface.dropTable('orders');
  }
};
