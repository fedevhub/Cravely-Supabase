const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Payment',
  table: 'payments',
  refs: {
    order: { column: 'order_id', model: () => require('./OrderModel') },
    user: { column: 'user_id', model: () => require('./UserModel') },
  },
  dates: ['paymentDate'],
});
