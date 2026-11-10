const createModel = require('./baseModel');

module.exports = createModel({
  name: 'User',
  table: 'users',
  trim: ['fullname', 'email', 'username', 'phoneNumber', 'address'],
  lowercase: ['email'],
});
