const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getFirebaseService } = require('../config/database');
const { protect } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array()
      });
    }

    const { email, password } = req.body;
    const firebaseService = getFirebaseService();

    // Check if user exists
    const user = await firebaseService.findUserByEmail(email);

    if (!user || !user.is_active) {
      // Log failed login attempt
      await logAudit(
        null, // No user ID for failed login
        'LOGIN_FAILED',
        'users',
        null,
        null,
        { email, reason: 'User not found' },
        req
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed login attempt
      await logAudit(
        user.id,
        'LOGIN_FAILED',
        'users',
        user.id,
        null,
        { email, reason: 'Invalid password' },
        req
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login
    await firebaseService.updateUser(user.id, {
      last_login: new Date()
    });

    // Create token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password from response
    delete user.password;

    // Log successful login
    await logAudit(
      user.id,
      'LOGIN_SUCCESS',
      'users',
      user.id,
      null,
      { login_time: new Date().toISOString() },
      req
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        badge_number: user.badge_number
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', [
  protect,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const firebaseService = getFirebaseService();

    // Get user with password
    const user = await firebaseService.findById('users', req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await firebaseService.updateUser(user.id, {
      password: hashedPassword
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    // Log logout action
    await logAudit(
      req.user.id,
      'LOGOUT',
      'users',
      req.user.id,
      null,
      { logout_time: new Date().toISOString() },
      req
    );

    // In a stateless JWT system, logout is handled client-side
    // You could implement a blacklist here if needed
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
