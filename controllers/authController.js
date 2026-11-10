const User = require('../models/UserModel');
const bcrypt = require('bcrypt');

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getRedirectUrlByRole = (role) => {
  if (role === 'admin') {
    return '/dashboard';
  }
  return '/customer/home';
};

const normalizeRedirectTarget = (target) => {
  if (!target || typeof target !== 'string') {
    return null;
  }

  if (target === '/admin' || target.startsWith('/dashboard')) {
    return '/dashboard';
  }

  if (target === '/customer' || target.startsWith('/customer')) {
    return '/customer/home';
  }

  return null;
};

const getRedirectUrlAfterLogin = (req, role) => {
  const requestedTarget = normalizeRedirectTarget(req.session.redirectAfterLogin);
  delete req.session.redirectAfterLogin;

  return getAllowedRedirectUrl(role, requestedTarget);
};

const getAllowedRedirectUrl = (role, requestedTarget) => {
  if (role === 'admin' && requestedTarget === '/dashboard') {
    return requestedTarget;
  }

  if (role === 'customer' && requestedTarget === '/customer/home') {
    return requestedTarget;
  }

  return getRedirectUrlByRole(role);
};

const renderAuthError = (res, view, message, values = {}, status = 400, errors = {}) => {
  return res.status(status).render(view, {
    error: message,
    values,
    errors,
  });
};

const setLoggedInUser = (req, user, callback) => {
  req.session.regenerate((err) => {
    if (err) return callback(err);

    req.session.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
    req.session.cookie.maxAge = SESSION_MAX_AGE;

    callback();
  });
};

const setFlash = (req, type, title, message) => {
  req.session.flash = { type, title, message };
};

const authController = {
  getRegister: (req, res) => {
    if (req.session.user) {
      return res.redirect(getRedirectUrlByRole(req.session.user.role));
    }

    res.render('auth/register', { error: null, values: {}, errors: {} });
  },

  getLogin: (req, res) => {
    const requestedTarget = normalizeRedirectTarget(req.query.redirect);

    if (requestedTarget) {
      req.session.redirectAfterLogin = requestedTarget;
    }

    if (req.session.user) {
      return res.redirect(getRedirectUrlAfterLogin(req, req.session.user.role));
    }

    res.render('auth/login', { error: null, values: {}, errors: {} });
  },

  register: async (req, res) => {
    try {
      const { fullname, username, email, password, role, phoneNumber, address } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await User.create({
        fullname,
        username,
        email,
        password: hashedPassword,
        role: 'customer',
        phoneNumber,
        address,
      });

      setLoggedInUser(req, user, (err) => {
        if (err) {
          console.log(err);
          return renderAuthError(
            res,
            'auth/register',
            "Your account was created, but we couldn't start your session. Please log in.",
            { fullname, username, email, phoneNumber, address },
            500,
          );
        }

        setFlash(
          req,
          'success',
          'Success',
          'Your account has been created and you are now logged in.',
        );

        // Redirect ke home customer
        res.redirect(getRedirectUrlByRole(user.role));
      });
    } catch (error) {
      console.log(error);
      renderAuthError(
        res,
        'auth/register',
        'Something went wrong while creating your account.',
        req.body,
        500,
      );
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const values = { email };

      const user = await User.findOne({ email });

      if (!user) {
        return renderAuthError(res, 'auth/login', 'Email or password is incorrect.', values, 401, {
          email: 'Email belum terdaftar atau tidak cocok.',
          password: 'Password salah. Coba masukkan password yang benar.',
        });
      }

      const match = await bcrypt.compare(password, user.password);
      const requestedTarget = normalizeRedirectTarget(req.session.redirectAfterLogin);

      if (!match) {
        return renderAuthError(res, 'auth/login', 'Email or password is incorrect.', values, 401, {
          password: 'Password salah. Coba masukkan password yang benar.',
        });
      }

      setLoggedInUser(req, user, (err) => {
        if (err) {
          console.log(err);
          return renderAuthError(
            res,
            'auth/login',
            "We couldn't start your login session. Please try again.",
            values,
            500,
          );
        }

        setFlash(req, 'success', 'Success', 'You are now logged in.');

        const targetUrl = getAllowedRedirectUrl(user.role, requestedTarget);
        res.redirect(targetUrl);
      });
    } catch (error) {
      console.log(error);
      renderAuthError(
        res,
        'auth/login',
        'Something went wrong on the server.',
        { email: req.body.email },
        500,
      );
    }
  },

  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
      }

      res.clearCookie('cravely.sid');
      res.set('Cache-Control', 'no-store');
      res.redirect('/auth/login?logout=success');
    });
  },
};

module.exports = authController;
