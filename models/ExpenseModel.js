const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Expense',
  table: 'expenses',
  refs: {
    rawMaterial: { column: 'raw_material_id', model: () => require('./RawMaterialModel') },
    createdBy: { column: 'created_by', model: () => require('./UserModel') },
  },
  dates: ['date'],
  trim: ['description'],
});
