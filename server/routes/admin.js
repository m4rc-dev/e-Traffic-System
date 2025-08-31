const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { protect, adminOnly } = require('../middleware/auth');
const { generateNextBadgeNumber } = require('../utils/badgeNumberGenerator');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    // Get total violations
    const [totalViolations] = await query('SELECT COUNT(*) as count FROM violations');
    
    // Get violations by status
    const violationsByStatus = await query(`
      SELECT status, COUNT(*) as count 
      FROM violations 
      GROUP BY status
    `);
    
    // Get violations by month (last 6 months)
    const violationsByMonth = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM violations 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);
    
    // Get total enforcers
    const [totalEnforcers] = await query('SELECT COUNT(*) as count FROM users WHERE role = "enforcer"');
    
    // Get active enforcers
    const [activeEnforcers] = await query('SELECT COUNT(*) as count FROM users WHERE role = "enforcer" AND is_active = TRUE');
    
    // Get total fines collected
    const [totalFines] = await query(`
      SELECT COALESCE(SUM(fine_amount), 0) as total 
      FROM violations 
      WHERE status = 'paid'
    `);
    
    // Get recent violations
    const recentViolations = await query(`
      SELECT v.*, u.full_name as enforcer_name
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      ORDER BY v.created_at DESC
      LIMIT 10
    `);

    res.status(200).json({
      success: true,
      data: {
        totalViolations: totalViolations.count,
        violationsByStatus,
        violationsByMonth,
        totalEnforcers: totalEnforcers.count,
        activeEnforcers: activeEnforcers.count,
        totalFines: parseFloat(totalFines.total),
        recentViolations
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get next available badge number
// @route   GET /api/admin/next-badge-number
// @access  Private (Admin only)
router.get('/next-badge-number', async (req, res) => {
  try {
    const nextBadgeNumber = await generateNextBadgeNumber();
    
    res.status(200).json({
      success: true,
      data: {
        next_badge_number: nextBadgeNumber
      }
    });
  } catch (error) {
    console.error('Get next badge number error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate badge number'
    });
  }
});

// @desc    Get all enforcers
// @route   GET /api/admin/enforcers
// @access  Private (Admin only)
router.get('/enforcers', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    
    // Ensure limit and page are valid numbers with explicit type conversion
    const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const validPage = Math.max(1, parseInt(page) || 1);
    const offset = (validPage - 1) * validLimit;
    
    // Double-check types
    if (typeof validLimit !== 'number' || isNaN(validLimit)) {
      throw new Error(`Invalid limit: ${limit}, converted to: ${validLimit}`);
    }
    if (typeof validPage !== 'number' || isNaN(validPage)) {
      throw new Error(`Invalid page: ${page}, converted to: ${validPage}`);
    }
    if (typeof offset !== 'number' || isNaN(offset)) {
      throw new Error(`Invalid offset: ${offset}`);
    }

    let whereClause = 'WHERE role = "enforcer"';
    let params = [];

    if (search) {
      whereClause += ' AND (full_name LIKE ? OR badge_number LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND is_active = ?';
      params.push(status === 'active' ? 1 : 0);
    }

    // Aggressive debugging
    console.log('=== ENFORCERS DEBUG START ===');
    console.log('req.query:', req.query);
    console.log('page:', page, 'limit:', limit);
    console.log('validLimit:', validLimit, 'type:', typeof validLimit);
    console.log('validPage:', validPage, 'type:', typeof validPage);
    console.log('offset:', offset, 'type:', typeof offset);
    console.log('params array:', params);
    console.log('final params array:', [...params, validLimit, offset]);
    console.log('=== ENFORCERS DEBUG END ===');
    
    // Get enforcers
    const enforcers = await query(`
      SELECT id, username, email, full_name, badge_number, phone_number, is_active, last_login, created_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, validLimit, offset]);

    // Get total count
    const [totalCount] = await query(`
      SELECT COUNT(*) as count 
      FROM users 
      ${whereClause}
    `, params);

    res.status(200).json({
      success: true,
      data: {
        enforcers,
        pagination: {
          current: validPage,
          total: Math.ceil(totalCount.count / validLimit),
          totalRecords: totalCount.count
        }
      }
    });

  } catch (error) {
    console.error('Get enforcers error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Create new enforcer
// @route   POST /api/admin/enforcers
// @access  Private (Admin only)
router.post('/enforcers', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('badge_number').notEmpty().withMessage('Badge number is required'),
  body('phone_number').optional().isMobilePhone().withMessage('Please provide a valid phone number')
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

    const { username, email, password, full_name, badge_number, phone_number } = req.body;

    // Check each field individually for specific error messages
    const duplicateErrors = [];
    
    // Check username
    const [existingUsername] = await query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsername) {
      duplicateErrors.push({ param: 'username', msg: 'Username already exists' });
    }
    
    // Check email
    const [existingEmail] = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingEmail) {
      duplicateErrors.push({ param: 'email', msg: 'Email already exists' });
    }
    
    // Check badge number
    const [existingBadge] = await query(
      'SELECT id FROM users WHERE badge_number = ?',
      [badge_number]
    );
    if (existingBadge) {
      duplicateErrors.push({ param: 'badge_number', msg: 'Badge number already exists' });
    }

    if (duplicateErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: duplicateErrors
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create enforcer with IoT device compatibility
    // - role: 'enforcer' allows access to IoT device endpoints
    // - is_active: TRUE enables login through /api/auth/login
    // - Hashed password ensures secure authentication
    const result = await query(`
      INSERT INTO users (username, email, password, role, full_name, badge_number, phone_number, is_active)
      VALUES (?, ?, ?, 'enforcer', ?, ?, ?, TRUE)
    `, [username, email, hashedPassword, full_name, badge_number, phone_number]);

    // Get created enforcer
    const [newEnforcer] = await query(
      'SELECT id, username, email, full_name, badge_number, phone_number, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Enforcer created successfully',
      data: newEnforcer
    });

  } catch (error) {
    console.error('Create enforcer error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Update enforcer
// @route   PUT /api/admin/enforcers/:id
// @access  Private (Admin only)
router.put('/enforcers/:id', [
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('badge_number').optional().notEmpty().withMessage('Badge number cannot be empty'),
  body('phone_number').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
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

    const { id } = req.params;
    const { full_name, badge_number, phone_number, is_active } = req.body;

    // Check if enforcer exists
    const [existingEnforcer] = await query(
      'SELECT id FROM users WHERE id = ? AND role = "enforcer"',
      [id]
    );

    if (!existingEnforcer) {
      return res.status(404).json({
        success: false,
        error: 'Enforcer not found'
      });
    }

    // Check if badge number is already taken by another enforcer
    if (badge_number) {
      const [duplicateBadge] = await query(
        'SELECT id FROM users WHERE badge_number = ? AND id != ?',
        [badge_number, id]
      );

      if (duplicateBadge) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: [{ param: 'badge_number', msg: 'Badge number already exists' }]
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (full_name !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }

    if (badge_number !== undefined) {
      updateFields.push('badge_number = ?');
      updateValues.push(badge_number);
    }

    if (phone_number !== undefined) {
      updateFields.push('phone_number = ?');
      updateValues.push(phone_number);
    }

    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateValues.push(id);

    // Update enforcer
    await query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // Get updated enforcer
    const [updatedEnforcer] = await query(
      'SELECT id, username, email, full_name, badge_number, phone_number, is_active, updated_at FROM users WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Enforcer updated successfully',
      data: updatedEnforcer
    });

  } catch (error) {
    console.error('Update enforcer error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Delete enforcer
// @route   DELETE /api/admin/enforcers/:id
// @access  Private (Admin only)
router.delete('/enforcers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if enforcer exists
    const [existingEnforcer] = await query(
      'SELECT id FROM users WHERE id = ? AND role = "enforcer"',
      [id]
    );

    if (!existingEnforcer) {
      return res.status(404).json({
        success: false,
        error: 'Enforcer not found'
      });
    }

    // Check if enforcer has any violations
    const [violationCount] = await query(
      'SELECT COUNT(*) as count FROM violations WHERE enforcer_id = ?',
      [id]
    );

    if (violationCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete enforcer with existing violations'
      });
    }

    // Delete enforcer
    await query('DELETE FROM users WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Enforcer deleted successfully'
    });

  } catch (error) {
    console.error('Delete enforcer error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
router.get('/settings', async (req, res) => {
  try {
    const settings = await query('SELECT * FROM system_settings ORDER BY setting_key');
    
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.setting_key] = setting.setting_value;
    });

    res.status(200).json({
      success: true,
      data: settingsObject
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await query(
        'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
        [value, key]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
