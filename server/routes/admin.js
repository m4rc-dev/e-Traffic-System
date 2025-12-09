const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, adminOnly } = require('../middleware/auth');
const { getFirebaseService } = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { generateNextBadgeNumber } = require('../utils/badgeNumberGenerator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Rate limiter for repeat offenders endpoint
const repeatOffendersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();

    // Get all violations
    const allViolations = await firebaseService.getViolations({}, { limit: 10000 });

    // Get all enforcers
    const allEnforcers = await firebaseService.getUsers({ role: 'enforcer' }, { limit: 1000 });

    // Calculate total violations
    const totalViolations = allViolations.length;

    // Calculate active enforcers (enforcers who are active)
    const activeEnforcers = allEnforcers.filter(e => e.is_active).length;

    // Calculate total enforcers
    const totalEnforcers = allEnforcers.length;

    // Calculate total fines (sum of all violation fines)
    const totalFines = allViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);

    // Calculate violations by status
    const violationsByStatus = [
      {
        status: 'pending',
        count: allViolations.filter(v => v.status === 'pending').length
      },
      {
        status: 'issued',
        count: allViolations.filter(v => v.status === 'issued').length
      },
      {
        status: 'paid',
        count: allViolations.filter(v => v.status === 'paid').length
      },
      {
        status: 'disputed',
        count: allViolations.filter(v => v.status === 'disputed').length
      },
      {
        status: 'cancelled',
        count: allViolations.filter(v => v.status === 'cancelled').length
      }
    ].filter(item => item.count > 0); // Only include statuses with violations

    // Calculate monthly data for trends (last 6 months)
    const monthlyData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      // Filter violations for this month
      const monthViolations = allViolations.filter(v => {
        const vDate = v.created_at?.toDate ? v.created_at.toDate() : new Date(v.created_at);
        return vDate >= monthStart && vDate <= monthEnd;
      });

      const totalViolationsInMonth = monthViolations.length;
      const totalFinesInMonth = monthViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
      const paidViolationsInMonth = monthViolations.filter(v => v.status === 'paid').length;
      const collectedFinesInMonth = monthViolations
        .filter(v => v.status === 'paid')
        .reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);

      monthlyData.push({
        month: monthDate.toISOString(),
        totalViolations: totalViolationsInMonth,
        totalFines: totalFinesInMonth,
        paidViolations: paidViolationsInMonth,
        collectedFines: collectedFinesInMonth
      });
    }

    // Get recent violations (last 10)
    const recentViolations = allViolations
      .sort((a, b) => {
        const aDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return bDate - aDate;
      })
      .slice(0, 10);

    // Get enforcer details for recent violations
    const recentViolationsWithEnforcer = await Promise.all(
      recentViolations.map(async (violation) => {
        if (violation.enforcer_id) {
          try {
            const enforcer = await firebaseService.findById('users', violation.enforcer_id);
            return {
              ...violation,
              enforcer_name: enforcer ? enforcer.full_name : 'Unknown',
              enforcer_badge: enforcer ? enforcer.badge_number : 'Unknown'
            };
          } catch (error) {
            console.error(`Error fetching enforcer for violation ${violation.id}:`, error);
            return {
              ...violation,
              enforcer_name: 'Unknown',
              enforcer_badge: 'Unknown'
            };
          }
        }
        return {
          ...violation,
          enforcer_name: 'Unknown',
          enforcer_badge: 'Unknown'
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        totalViolations,
        activeEnforcers,
        totalEnforcers,
        totalFines,
        violationsByStatus,
        monthlyData,
        recentViolations: recentViolationsWithEnforcer
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data'
    });
  }
});

// Add rate limiting middleware

// Apply rate limiting to the repeat offenders endpoint
router.get('/repeat-offenders', repeatOffendersLimiter, async (req, res) => {
  try {
    const { min_violations = 2 } = req.query;
    const firebaseService = getFirebaseService();

    console.log('Repeat offenders request received with params:', req.query);

    // Get all violations
    const allViolations = await firebaseService.getViolations({}, { limit: 10000 });
    console.log(`Found ${allViolations.length} total violations`);

    // Group by violator (using license plate as identifier)
    const violatorGroups = {};
    allViolations.forEach(violation => {
      // Use violator license as primary identifier, fallback to other fields
      const key = violation.violator_license || violation.vehicle_plate || violation.violator_name;
      if (key) {
        if (!violatorGroups[key]) {
          violatorGroups[key] = [];
        }
        violatorGroups[key].push(violation);
      } else {
        console.log('Violation without identifier fields:', {
          id: violation.id,
          violator_name: violation.violator_name,
          violator_license: violation.violator_license,
          vehicle_plate: violation.vehicle_plate
        });
      }
    });

    console.log(`Grouped into ${Object.keys(violatorGroups).length} violator groups`);

    // Show some sample groups for debugging
    const sampleGroups = Object.entries(violatorGroups).slice(0, 5);
    sampleGroups.forEach(([key, violations]) => {
      console.log(`Group ${key}: ${violations.length} violations`);
    });

    // Find repeat offenders (based on min_violations parameter, default 2)
    const repeatOffenders = Object.entries(violatorGroups)
      .filter(([key, violations]) => {
        const isRepeat = violations.length >= parseInt(min_violations);
        if (isRepeat) {
          console.log(`Repeat offender found: ${key} with ${violations.length} violations`);
        }
        return isRepeat;
      })
      .map(([key, violations]) => {
        // Sort violations by date (newest first)
        violations.sort((a, b) => {
          const aDate = new Date(a.created_at?.toDate ? a.created_at.toDate() : a.created_at);
          const bDate = new Date(b.created_at?.toDate ? b.created_at.toDate() : b.created_at);
          return bDate - aDate;
        });

        // Get first and last violation details
        const firstViolation = violations[violations.length - 1];
        const lastViolation = violations[0];

        // Calculate financial statistics
        const totalFines = violations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
        const paidFines = violations
          .filter(v => v.status === 'paid')
          .reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
        const pendingFines = violations
          .filter(v => v.status === 'pending' || v.status === 'issued')
          .reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);

        return {
          identifier: key,
          violator_name: lastViolation.violator_name,
          violator_license: lastViolation.violator_license,
          violator_phone: lastViolation.violator_phone,
          total_violations: violations.length,
          total_fines: totalFines,
          paid_fines: paidFines,
          pending_fines: pendingFines,
          first_violation_date: firstViolation.created_at,
          first_violation_type: firstViolation.violation_type,
          last_violation_date: lastViolation.created_at,
          last_violation_type: lastViolation.violation_type,
          violations: violations.slice(0, 5) // Show last 5 violations
        };
      })
      .sort((a, b) => b.total_violations - a.total_violations);

    // Apply limit if specified
    const { limit } = req.query;
    const limitedRepeatOffenders = limit
      ? repeatOffenders.slice(0, parseInt(limit))
      : repeatOffenders;

    console.log(`Found ${repeatOffenders.length} repeat offenders, returning ${limitedRepeatOffenders.length} (limit: ${limit})`);

    // Calculate statistics
    const totalRepeatOffenders = repeatOffenders.length;
    const avgViolationsPerOffender = totalRepeatOffenders > 0
      ? repeatOffenders.reduce((sum, offender) => sum + offender.total_violations, 0) / totalRepeatOffenders
      : 0;
    const maxViolations = totalRepeatOffenders > 0
      ? Math.max(...repeatOffenders.map(offender => offender.total_violations))
      : 0;

    const statistics = {
      total_repeat_offenders: totalRepeatOffenders,
      avg_violations_per_offender: avgViolationsPerOffender.toFixed(1),
      max_violations: maxViolations
    };

    const response = {
      success: true,
      data: {
        repeatOffenders: limitedRepeatOffenders,
        statistics
      }
    };

    console.log('Sending repeat offenders response:', {
      repeatOffendersCount: limitedRepeatOffenders.length,
      statistics
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('Repeat offenders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load repeat offenders data'
    });
  }
});

// @desc    Get violation statistics
// @route   GET /api/admin/violation-stats
// @access  Private (Admin only)
router.get('/violation-stats', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();

    // Get all violations
    const allViolations = await firebaseService.getViolations({}, { limit: 1000 });

    // Calculate statistics
    const stats = {
      totalViolations: allViolations.length,
      totalFines: allViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      collectedFines: allViolations
        .filter(v => v.status === 'paid')
        .reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      pendingFines: allViolations
        .filter(v => v.status === 'pending' || v.status === 'issued')
        .reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      paidViolations: allViolations.filter(v => v.status === 'paid').length,
      pendingViolations: allViolations.filter(v => v.status === 'pending' || v.status === 'issued').length,
      disputedViolations: allViolations.filter(v => v.status === 'disputed').length,
      cancelledViolations: allViolations.filter(v => v.status === 'cancelled').length
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Violation stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load violation statistics'
    });
  }
});

// @desc    Get all enforcers
// @route   GET /api/admin/enforcers
// @access  Private (Admin only)
router.get('/enforcers', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();

    // Get enforcers without ordering (Firebase doesn't support orderBy on non-indexed fields easily)
    let enforcers = await firebaseService.getUsers({ role: 'enforcer' }, { limit: 1000 });

    // Sort by created_at in memory (descending - newest first)
    enforcers.sort((a, b) => {
      const aDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
      const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
      return bDate - aDate;
    });

    // Remove passwords from response
    const safeEnforcers = enforcers.map(enforcer => {
      const { password, ...safeEnforcer } = enforcer;
      return safeEnforcer;
    });

    res.status(200).json({
      success: true,
      data: safeEnforcers
    });

  } catch (error) {
    console.error('Get enforcers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load enforcers'
    });
  }
});

// @desc    Get next badge number
// @route   GET /api/admin/next-badge-number
// @access  Private (Admin only)
router.get('/next-badge-number', async (req, res) => {
  try {
    const badgeNumber = await generateNextBadgeNumber();

    res.status(200).json({
      success: true,
      data: {
        next_badge_number: badgeNumber
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

// @desc    Create new enforcer
// @route   POST /api/admin/enforcers
// @access  Private (Admin only)
router.post('/enforcers', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name is required'),
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

    const { username, email, password, full_name, phone_number } = req.body;
    const firebaseService = getFirebaseService();

    // Check if username already exists
    const existingUserByUsername = await firebaseService.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Check if email already exists
    const existingUserByEmail = await firebaseService.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Generate badge number
    const badgeNumber = await generateNextBadgeNumber();

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create enforcer
    const enforcer = await firebaseService.createUser({
      username,
      email,
      password: hashedPassword,
      role: 'enforcer',
      full_name,
      badge_number: badgeNumber,
      phone_number: phone_number || '',
      is_active: true
    });

    // Log audit
    await logAudit(
      req.user.id,
      'CREATE_ENFORCER',
      'users',
      enforcer.id,
      null,
      { username, email, full_name, badge_number: badgeNumber },
      req
    );

    // Remove password from response
    delete enforcer.password;

    res.status(201).json({
      success: true,
      data: enforcer,
      message: 'Enforcer created successfully'
    });

  } catch (error) {
    console.error('Create enforcer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create enforcer'
    });
  }
});

// @desc    Update enforcer
// @route   PUT /api/admin/enforcers/:id
// @access  Private (Admin only)
router.put('/enforcers/:id', [
  body('username').optional().notEmpty().withMessage('Username cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
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
    const updateData = req.body;
    const firebaseService = getFirebaseService();

    // Get current enforcer
    const currentEnforcer = await firebaseService.findById('users', id);
    if (!currentEnforcer) {
      return res.status(404).json({
        success: false,
        error: 'Enforcer not found'
      });
    }

    if (currentEnforcer.role !== 'enforcer') {
      return res.status(400).json({
        success: false,
        error: 'User is not an enforcer'
      });
    }

    // Check for duplicate username if changing
    if (updateData.username && updateData.username !== currentEnforcer.username) {
      const existingUser = await firebaseService.findUserByUsername(updateData.username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already exists'
        });
      }
    }

    // Check for duplicate email if changing
    if (updateData.email && updateData.email !== currentEnforcer.email) {
      const existingUser = await firebaseService.findUserByEmail(updateData.email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
    }

    // Update enforcer
    const updatedEnforcer = await firebaseService.updateUser(id, updateData);

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE_ENFORCER',
      'users',
      id,
      currentEnforcer,
      updateData,
      req
    );

    // Remove password from response
    delete updatedEnforcer.password;

    res.status(200).json({
      success: true,
      data: updatedEnforcer,
      message: 'Enforcer updated successfully'
    });

  } catch (error) {
    console.error('Update enforcer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update enforcer'
    });
  }
});

// @desc    Delete enforcer
// @route   DELETE /api/admin/enforcers/:id
// @access  Private (Admin only)
router.delete('/enforcers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseService = getFirebaseService();

    // Get enforcer
    const enforcer = await firebaseService.findById('users', id);
    if (!enforcer) {
      return res.status(404).json({
        success: false,
        error: 'Enforcer not found'
      });
    }

    if (enforcer.role !== 'enforcer') {
      return res.status(400).json({
        success: false,
        error: 'User is not an enforcer'
      });
    }

    // Delete enforcer
    await firebaseService.deleteUser(id);

    // Log audit
    await logAudit(
      req.user.id,
      'DELETE_ENFORCER',
      'users',
      id,
      enforcer,
      null,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Enforcer deleted successfully'
    });

  } catch (error) {
    console.error('Delete enforcer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete enforcer'
    });
  }
});

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
router.get('/settings', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();

    // Get all settings
    const settings = await firebaseService.getSettings();

    // If no settings exist, return default settings
    if (!settings || settings.length === 0) {
      const defaultSettings = {
        system_name: 'e-Traffic System',
        system_description: 'Traffic violation management system',
        admin_email: '',
        timezone: 'Asia/Manila',
        date_format: 'MM/DD/YYYY',
        currency: 'PHP',
        sms_api_key: '',
        sms_api_url: '',
        sms_sender_id: '',
        sms_enabled: false,
        session_timeout: 30,
        max_login_attempts: 5,
        password_min_length: 8,
        require_strong_password: true,
        email_notifications: true,
        violation_alerts: true,
        debug_mode: false,
        auto_backup: true
      };

      return res.status(200).json({
        success: true,
        data: defaultSettings
      });
    }

    // Return the first (and should be only) settings document
    res.status(200).json({
      success: true,
      data: settings[0]
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load settings'
    });
  }
});

// @desc    Update system settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
router.put('/settings', [
  body('system_name').optional().notEmpty().withMessage('System name cannot be empty'),
  body('admin_email').optional().isEmail().withMessage('Please provide a valid email'),
  body('session_timeout').optional().isInt({ min: 5, max: 480 }).withMessage('Session timeout must be between 5 and 480 minutes'),
  body('max_login_attempts').optional().isInt({ min: 3, max: 10 }).withMessage('Max login attempts must be between 3 and 10'),
  body('password_min_length').optional().isInt({ min: 6, max: 20 }).withMessage('Password length must be between 6 and 20'),
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

    const firebaseService = getFirebaseService();
    const updateData = req.body;

    // Get existing settings
    const existingSettings = await firebaseService.getSettings();

    let updatedSettings;

    if (!existingSettings || existingSettings.length === 0) {
      // Create new settings document if none exists
      updatedSettings = await firebaseService.createSetting(updateData);
    } else {
      // Update existing settings document
      const settingsId = existingSettings[0].id;
      updatedSettings = await firebaseService.updateSetting(settingsId, updateData);
    }

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE_SETTINGS',
      'system_settings',
      updatedSettings.id,
      existingSettings && existingSettings.length > 0 ? existingSettings[0] : null,
      updateData,
      req
    );

    res.status(200).json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

module.exports = router;