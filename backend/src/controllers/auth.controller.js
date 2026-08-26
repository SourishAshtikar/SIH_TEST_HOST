const authService = require('../services/auth.service');

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    const user = await authService.register({ name, email, password, role });

    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'An unexpected error occurred during registration' : error.message;

    if (statusCode === 500) {
      console.error('Registration error:', error);
    }

    return res.status(statusCode).json({
      status: 'error',
      message
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await authService.login({ email, password });

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'An unexpected error occurred during login' : error.message;

    if (statusCode === 500) {
      console.error('Login error:', error);
    }

    return res.status(statusCode).json({
      status: 'error',
      message
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);

    return res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'An unexpected error occurred' : error.message;

    if (statusCode === 500) {
      console.error('Get profile error:', error);
    }

    return res.status(statusCode).json({
      status: 'error',
      message
    });
  }
};

const adminTest = async (req, res) => {
  return res.status(200).json({
    status: 'success',
    message: 'Admin authorization verified successfully',
    data: {
      user: req.user
    }
  });
};

module.exports = {
  register,
  login,
  getMe,
  adminTest
};
