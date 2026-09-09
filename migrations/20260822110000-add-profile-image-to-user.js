'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.profileImageUrl) {
      await queryInterface.addColumn('users', 'profileImageUrl', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.profileImageUrl) await queryInterface.removeColumn('users', 'profileImageUrl');
  },
};
