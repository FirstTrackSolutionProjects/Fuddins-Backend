'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const tableNames = await qi.showAllTables();
    const has = (name) => tableNames.map(String).includes(name);

    if (has('orders')) {
      const cols = await qi.describeTable('orders');
      if (!cols.customerId) await qi.addColumn('orders','customerId',{type:Sequelize.INTEGER,allowNull:true});
    }
    if (has('products')) {
      const cols = await qi.describeTable('products');
      if (!cols.approvalStatus) await qi.addColumn('products','approvalStatus',{type:Sequelize.STRING,allowNull:false,defaultValue:'approved'});
      if (!cols.approvedBy) await qi.addColumn('products','approvedBy',{type:Sequelize.INTEGER,allowNull:true});
      if (!cols.approvedAt) await qi.addColumn('products','approvedAt',{type:Sequelize.DATE,allowNull:true});
      if (!cols.rejectionReason) await qi.addColumn('products','rejectionReason',{type:Sequelize.TEXT,allowNull:true});
      if (!cols.submittedAt) await qi.addColumn('products','submittedAt',{type:Sequelize.DATE,allowNull:true});
      if (!cols.reservedStock) await qi.addColumn('products','reservedStock',{type:Sequelize.INTEGER,allowNull:false,defaultValue:0});
      if (!cols.lowStockThreshold) await qi.addColumn('products','lowStockThreshold',{type:Sequelize.INTEGER,allowNull:false,defaultValue:5});
    }
    if (!has('order_items')) await qi.createTable('order_items',{
      id:{type:Sequelize.INTEGER,autoIncrement:true,primaryKey:true}, orderId:{type:Sequelize.INTEGER,allowNull:false},
      vendorId:{type:Sequelize.INTEGER,allowNull:true}, productId:{type:Sequelize.INTEGER,allowNull:false},
      productName:{type:Sequelize.STRING,allowNull:false}, sku:{type:Sequelize.STRING,allowNull:true}, variationId:{type:Sequelize.INTEGER,allowNull:true},
      quantity:{type:Sequelize.INTEGER,allowNull:false}, unitPrice:{type:Sequelize.FLOAT,allowNull:false}, discount:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},
      tax:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0}, subtotal:{type:Sequelize.FLOAT,allowNull:false}, itemStatus:{type:Sequelize.STRING,allowNull:false,defaultValue:'pending'},
      createdAt:{type:Sequelize.DATE,allowNull:false},updatedAt:{type:Sequelize.DATE,allowNull:false}
    });
    if (!has('vendor_orders')) await qi.createTable('vendor_orders',{
      id:{type:Sequelize.INTEGER,autoIncrement:true,primaryKey:true},orderId:{type:Sequelize.INTEGER,allowNull:false},vendorId:{type:Sequelize.INTEGER,allowNull:false},
      subtotal:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},discount:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},tax:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},deliveryFee:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},
      commissionAmount:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},refundAmount:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},vendorPayable:{type:Sequelize.FLOAT,allowNull:false,defaultValue:0},
      status:{type:Sequelize.STRING,allowNull:false,defaultValue:'pending'},deliveryUserId:{type:Sequelize.INTEGER,allowNull:true},
      acceptedAt:{type:Sequelize.DATE,allowNull:true},preparingAt:{type:Sequelize.DATE,allowNull:true},readyAt:{type:Sequelize.DATE,allowNull:true},pickedUpAt:{type:Sequelize.DATE,allowNull:true},deliveredAt:{type:Sequelize.DATE,allowNull:true},cancelledAt:{type:Sequelize.DATE,allowNull:true},
      rejectionReason:{type:Sequelize.TEXT,allowNull:true},cancellationReason:{type:Sequelize.TEXT,allowNull:true},createdAt:{type:Sequelize.DATE,allowNull:false},updatedAt:{type:Sequelize.DATE,allowNull:false}
    });
    if (!has('inventory_transactions')) await qi.createTable('inventory_transactions',{
      id:{type:Sequelize.INTEGER,autoIncrement:true,primaryKey:true},productId:{type:Sequelize.INTEGER,allowNull:false},vendorId:{type:Sequelize.INTEGER,allowNull:true},variantId:{type:Sequelize.INTEGER,allowNull:true},
      type:{type:Sequelize.STRING,allowNull:false},quantity:{type:Sequelize.INTEGER,allowNull:false},previousStock:{type:Sequelize.INTEGER,allowNull:false},newStock:{type:Sequelize.INTEGER,allowNull:false},
      referenceType:{type:Sequelize.STRING,allowNull:true},referenceId:{type:Sequelize.STRING,allowNull:true},createdBy:{type:Sequelize.INTEGER,allowNull:true},createdAt:{type:Sequelize.DATE,allowNull:false},updatedAt:{type:Sequelize.DATE,allowNull:false}
    });
    if (!has('notifications')) await qi.createTable('notifications',{
      id:{type:Sequelize.INTEGER,autoIncrement:true,primaryKey:true},userId:{type:Sequelize.INTEGER,allowNull:false},type:{type:Sequelize.STRING,allowNull:false},title:{type:Sequelize.STRING,allowNull:false},message:{type:Sequelize.TEXT,allowNull:false},data:{type:Sequelize.TEXT,allowNull:true},readAt:{type:Sequelize.DATE,allowNull:true},createdAt:{type:Sequelize.DATE,allowNull:false},updatedAt:{type:Sequelize.DATE,allowNull:false}
    });
  },
  async down(queryInterface) {
    for (const t of ['notifications','inventory_transactions','vendor_orders','order_items']) {
      try { await queryInterface.dropTable(t); } catch {}
    }
    try { await queryInterface.removeColumn('products','approvalStatus'); } catch {}
    try { await queryInterface.removeColumn('products','approvedBy'); } catch {}
    try { await queryInterface.removeColumn('products','approvedAt'); } catch {}
    try { await queryInterface.removeColumn('products','rejectionReason'); } catch {}
    try { await queryInterface.removeColumn('products','submittedAt'); } catch {}
    try { await queryInterface.removeColumn('products','reservedStock'); } catch {}
    try { await queryInterface.removeColumn('products','lowStockThreshold'); } catch {}
    try { await queryInterface.removeColumn('orders','customerId'); } catch {}
  }
};
