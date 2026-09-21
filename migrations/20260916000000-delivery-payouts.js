'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const fields = { payoutMethod: { type: Sequelize.STRING, allowNull: true }, payoutUpiId: { type: Sequelize.STRING, allowNull: true }, payoutAccountNumber: { type: Sequelize.STRING, allowNull: true }, payoutIfsc: { type: Sequelize.STRING, allowNull: true }, payoutAccountHolderName: { type: Sequelize.STRING, allowNull: true } };
    for (const [name, definition] of Object.entries(fields)) await queryInterface.addColumn('users', name, definition);
    await queryInterface.createTable('delivery_payout_requests', { id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true }, deliveryUserId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } }, amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false }, method: { type: Sequelize.STRING, allowNull: false }, accountSnapshot: { type: Sequelize.TEXT, allowNull: false }, status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' }, razorpayPayoutId: { type: Sequelize.STRING, allowNull: true }, failureReason: { type: Sequelize.TEXT, allowNull: true }, processedAt: { type: Sequelize.DATE, allowNull: true }, createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false } });
  },
  async down(queryInterface) { await queryInterface.dropTable('delivery_payout_requests'); for (const field of ['payoutMethod', 'payoutUpiId', 'payoutAccountNumber', 'payoutIfsc', 'payoutAccountHolderName']) await queryInterface.removeColumn('users', field); },
};
