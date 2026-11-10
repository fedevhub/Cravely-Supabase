const User = require('../models/UserModel');

const renderAuthError = (res, view, message, values = {}, errors = {}) => {
  return res.status(400).render(view, {
    error: message,
    values,
    errors,
  });
};

const getEmailError = (email) => {
  if (!email) return 'Email wajib diisi.';
  if (/\s/.test(email)) return 'Email tidak boleh mengandung spasi.';
  if (!email.includes('@')) return 'Email harus memakai tanda @.';

  const [localPart, domainPart] = email.split('@');

  if (!localPart) return 'Bagian sebelum @ tidak boleh kosong.';
  if (!domainPart) return 'Domain email setelah @ wajib diisi.';
  if (!domainPart.includes('.')) {
    return 'Domain email harus lengkap, contoh: nama@email.com.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Format email tidak valid. Contoh yang benar: nama@email.com.';
  }

  return null;
};

const authMiddleware = {
  validateRegister: async (req, res, next) => {
    try {
      req.body = req.body || {};

      let { fullname, username, email, password, phoneNumber, address } = req.body;

      fullname = fullname?.trim();
      username = username?.trim();
      email = email?.trim().toLowerCase();
      password = password?.trim();
      phoneNumber = phoneNumber?.trim();
      address = address?.trim();

      req.body.fullname = fullname;
      req.body.username = username;
      req.body.email = email;
      req.body.password = password;
      req.body.phoneNumber = phoneNumber;
      req.body.address = address;

      const values = { fullname, username, email, phoneNumber, address };
      const errors = {};

      if (!fullname) errors.fullname = 'Fullname wajib diisi.';
      else if (fullname.length < 3) {
        errors.fullname = 'Fullname minimal 3 karakter.';
      }

      if (!username) errors.username = 'Username wajib diisi.';
      else if (username.length < 3) {
        errors.username = 'Username minimal 3 karakter.';
      }

      const emailError = getEmailError(email);
      if (emailError) errors.email = emailError;

      if (!password) errors.password = 'Password wajib diisi.';
      else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        errors.password =
          'Password minimal 8 karakter, harus ada huruf besar, huruf kecil, dan angka.';
      }

      if (!phoneNumber) errors.phoneNumber = 'Nomor telepon wajib diisi.';
      else if (!/^[0-9]{10,15}$/.test(phoneNumber)) {
        errors.phoneNumber = 'Nomor telepon hanya boleh angka, 10 sampai 15 digit.';
      }

      if (!address) errors.address = 'Alamat wajib diisi.';
      else if (address.length < 5) errors.address = 'Alamat minimal 5 karakter.';

      if (Object.keys(errors).length > 0) {
        return renderAuthError(
          res,
          'auth/register',
          'Please check your registration details.',
          values,
          errors,
        );
      }

      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        if (existingUser.email === email) {
          errors.email = 'Email sudah terdaftar. Gunakan email lain atau login.';
        }

        if (existingUser.username === username) {
          errors.username = 'Username sudah digunakan. Pilih username lain.';
        }

        return renderAuthError(
          res,
          'auth/register',
          "We couldn't create your account.",
          values,
          errors,
        );
      }

      next();
    } catch (err) {
      console.log(err);
      res.status(500).send('Server Error');
    }
  },

  validateLogin: (req, res, next) => {
    req.body = req.body || {};

    let { email, password } = req.body;

    email = email?.trim().toLowerCase();
    password = password?.trim();

    req.body.email = email;
    req.body.password = password;

    const values = { email };
    const errors = {};

    const emailError = getEmailError(email);
    if (emailError) errors.email = emailError;

    if (!password) errors.password = 'Password wajib diisi.';

    if (Object.keys(errors).length > 0) {
      return renderAuthError(res, 'auth/login', 'Please check your login details.', values, errors);
    }

    next();
  },
};

module.exports = authMiddleware;
