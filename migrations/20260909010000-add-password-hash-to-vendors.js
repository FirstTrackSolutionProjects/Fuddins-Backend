'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('vendors');
    if (!table.passwordHash) {
      await queryInterface.addColumn('vendors', 'passwordHash', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('vendors');
    if (table.passwordHash) await queryInterface.removeColumn('vendors', 'passwordHash');
  },
};