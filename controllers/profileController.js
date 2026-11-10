const bcrypt = require('bcrypt');
const User = require('../models/UserModel');

exports.getProfile = async (req, res) => {
  const user = await User.findById(req.session.user.id);
  res.render('shared/profile', { user, isAdmin: user.role === 'admin' });
};

exports.updateProfile = async (req, res) => {
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send('User tidak ditemukan');
  user.fullname = req.body.fullname?.trim() || user.fullname;
  user.username = req.body.username?.trim() || user.username;
  user.email = req.body.email?.trim().toLowerCase() || user.email;
  user.phoneNumber = req.body.phoneNumber?.trim() || user.phoneNumber;
  user.address = req.body.address?.trim() || user.address;
  if (req.body.password) user.password = await bcrypt.hash(req.body.password, 10);
  await user.save();
  req.session.user.username = user.username;
  req.session.user.email = user.email;
  res.redirect('/profile');
};
