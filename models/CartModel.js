const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Cart',
  table: 'carts',
  refs: { user: { column: 'user_id', model: () => require('./UserModel') } },
  embedded: { 'items.product': { model: () => require('./ProductModel') } },
});
