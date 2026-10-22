'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('vendors');
    const missingColumns = {
      storeLogoUrl: { type: Sequelize.STRING, allowNull: true },
      storeBannerUrl: { type: Sequelize.STRING, allowNull: true },
      address1: { type: Sequelize.STRING, allowNull: true },
      address2: { type: Sequelize.STRING, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true },
      postcode: { type: Sequelize.STRING, allowNull: true },
      country: { type: Sequelize.STRING, allowNull: true },
      state: { type: Sequelize.STRING, allowNull: true },
      storeLocation: { type: Sequelize.STRING, allowNull: true },
      shopDescription: { type: Sequelize.TEXT, allowNull: true },
    };

    for (const [name, definition] of Object.entries(missingColumns)) {
      if (!columns[name]) await queryInterface.addColumn('vendors', name, definition);
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('vendors');
    for (const name of [
      'shopDescription',
      'storeLocation',
      'state',
      'country',
      'postcode',
      'city',
      'address2',
      'address1',
      'storeBannerUrl',
      'storeLogoUrl',
    ]) {
      if (columns[name]) await queryInterface.removeColumn('vendors', name);
    }
  },
};
