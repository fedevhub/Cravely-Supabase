const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Wishlist',
  table: 'wishlists',
  refs: { user: { column: 'user_id', model: () => require('./UserModel') } },
  embedded: { products: { model: () => require('./ProductModel') } },
});
