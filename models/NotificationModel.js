const createModel = require('./baseModel');

module.exports = createModel({
  name: 'Notification',
  table: 'notifications',
  refs: { recipient: { column: 'recipient', model: () => require('./UserModel') } },
  dates: ['readAt'],
});
