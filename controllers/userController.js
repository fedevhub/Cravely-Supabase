const User = require('../models/UserModel');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const userController = {
  getDaftarUser: async (req, res) => {
    try {
      const admins = await User.find({ role: { $ne: 'customer' } });
      const customers = await User.find({ role: 'customer' });

      res.render('admin/users', {
        admins,
        customers,
        editUser: null,
        pageTitle: 'Manajemen Pengguna',
      });
    } catch (error) {
      console.error('Error getDaftarUser:', error);
      res.status(500).send('Gagal ambil data pengguna');
    }
  },

  getTambahUser: async (req, res) => {
    try {
      const admins = await User.find({ role: { $ne: 'customer' } });
      const customers = await User.find({ role: 'customer' });

      res.render('admin/users', {
        admins,
        customers,
        editUser: null,
        pageTitle: 'Manajemen Pengguna',
      });
    } catch (err) {
      console.error('Error getTambahUser:', err);
      res.status(500).send('Gagal memuat halaman pengguna');
    }
  },

  tambahUser: async (req, res) => {
    try {
      const { fullname, username, email, password, role, phoneNumber, adress, address } = req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        req.session.flash = {
          type: 'danger',
          title: 'Gagal Tambah User',
          message: 'Username atau Email sudah terdaftar!',
          icon: 'fa-user-xmark',
        };
        return res.redirect('/dashboard/users');
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await User.create({
        fullname,
        username,
        email,
        password: hashedPassword,
        role: role || 'admin',
        phoneNumber,
        address: adress || address,
      });

      req.session.flash = {
        type: 'success',
        title: 'User Created',
        message: 'The user has been created successfully.',
        icon: 'fa-user-check',
      };

      res.redirect('/dashboard/users');
    } catch (err) {
      console.error('Error tambahUser:', err);
      res.status(500).send('Gagal tambah pengguna: ' + err.message);
    }
  },

  getEditUser: async (req, res) => {
    try {
      const editUser = await User.findById(req.params.id);

      if (!editUser) {
        return res.status(404).send('Data pengguna tidak ditemukan');
      }

      const admins = await User.find({ role: { $ne: 'customer' } });
      const customers = await User.find({ role: 'customer' });

      res.render('admin/users', {
        admins,
        customers,
        editUser: editUser,
        pageTitle: 'Edit Pengguna',
      });
    } catch (err) {
      console.error('Error getEditUser:', err);
      res.status(500).send('Gagal memuat data edit');
    }
  },

  updateUser: async (req, res) => {
    try {
      const existingUser = await User.findById(req.params.id);
      if (!existingUser) {
        return res.status(404).send('Data pengguna tidak ditemukan');
      }

      const data = {
        fullname: req.body.fullname ?? existingUser.fullname,
        username: req.body.username ?? existingUser.username,
        email: req.body.email ?? existingUser.email,
        role: req.body.role ?? existingUser.role,
        phoneNumber: req.body.phoneNumber ?? existingUser.phoneNumber,
        address: req.body.adress ?? req.body.address ?? existingUser.address ?? existingUser.adress,
      };

      if (req.body.password && req.body.password.trim() !== '') {
        const saltRounds = 10;
        data.password = await bcrypt.hash(req.body.password, saltRounds);
      }

      await User.findByIdAndUpdate(req.params.id, data, {
        returnDocument: 'after',
        runValidators: true,
      });

      req.session.flash = {
        type: 'success',
        title: 'User Updated',
        message: 'The user has been updated successfully.',
        icon: 'fa-user-pen',
      };

      res.redirect('/dashboard/users');
    } catch (err) {
      console.error('Error updateUser:', err);
      res.status(500).send('Gagal update: ' + err.message);
    }
  },

  deleteUser: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).send('Pengguna tidak ditemukan');
      }

      await User.findByIdAndDelete(req.params.id);

      req.session.flash = {
        type: 'success',
        title: 'User Deleted',
        message: 'The user has been deleted successfully.',
        icon: 'fa-user-minus',
      };

      res.redirect('/dashboard/users');
    } catch (err) {
      console.error('Error deleteUser:', err);
      res.status(500).send('Gagal hapus pengguna');
    }
  },
};

module.exports = userController;
