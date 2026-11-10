const createModel = require('./baseModel');

module.exports = createModel({
  name: 'PreOrderSetting',
  table: 'pre_order_settings',
  refs: { updatedBy: { column: 'updated_by', model: () => require('./UserModel') } },
});
