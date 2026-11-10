const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Review',
  table: 'reviews',
  refs: {
    product: { column: 'product_id', model: () => require('./ProductModel') },
    user: { column: 'user_id', model: () => require('./UserModel') },
  },
  trim: ['comment'],
});
