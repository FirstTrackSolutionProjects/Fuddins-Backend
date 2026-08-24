'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.referralCode) {
      await queryInterface.addColumn('users', 'referralCode', {
        type: Sequelize.STRING(32), allowNull: true, unique: true,
      });
    }
    if (!table.referredByUserId) {
      await queryInterface.addColumn('users', 'referredByUserId', {
        type: Sequelize.INTEGER, allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.referredByUserId) await queryInterface.removeColumn('users', 'referredByUserId');
    if (table.referralCode) await queryInterface.removeColumn('users', 'referralCode');
  },
};
