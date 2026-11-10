const createModel = require('./baseModel');

module.exports = createModel({
  name: 'RawMaterial',
  table: 'raw_materials',
  trim: ['name', 'unit', 'supplier', 'notes'],
});
