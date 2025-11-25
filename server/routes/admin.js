const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getFirebaseService } = require('../config/database');
const { protect, adminOnly } = require('../middleware/auth');
const { generateNextBadgeNumber } = require('../utils/badgeNumberGenerator');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();
    
    // Get total violations
    const totalViolations = await firebaseService.count('violations');
    
    // Get violations by status
    const allViolations = await firebaseService.getViolations({}, { limit: 1000 });
    const violationsByStatusObj = {};
    allViolations.forEach(violation => {
      const status = violation.status || 'unknown';
      violationsByStatusObj[status] = (violationsByStatusObj[status] || 0) + 1;
    });
    
    // Convert to array format expected by frontend
    const violationsByStatus = Object.entries(violationsByStatusObj).map(([status, count]) => ({
      status,
      count
    }));
    
    // Get violations by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthKey = month.toISOString().substring(0, 7); // YYYY-MM format
      
      const monthViolations = allViolations.filter(violation => {
        if (!violation.created_at) return false;
        const violationDate = new Date(violation.created_at.toDate ? violation.created_at.toDate() : violation.created_at);
        const violationMonth = violationDate.toISOString().substring(0, 7);
        return violationMonth === monthKey;
      });
      
      const totalFines = monthViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
      const collectedFines = monthViolations
        .filter(v => v.status === 'paid')
        .reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
      const paidViolations = monthViolations.filter(v => v.status === 'paid').length;
      
      monthlyData.push({
        month: monthKey,
        totalViolations: monthViolations.length,
        totalFines,
        collectedFines,
        paidViolations
      });
    }
    
    // Get total enforcers
    const totalEnforcers = await firebaseService.count('users', { role: 'enforcer' });
    
    // Get active enforcers
    const activeEnforcers = await firebaseService.count('users', { role: 'enforcer', is_active: true });
    
    // Get total fines collected
    const paidViolations = allViolations.filter(v => v.status === 'paid');
    const totalFines = paidViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
    
    // Get recent violations (last 7 days) with enforcer details
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let recentViolations = allViolations.filter(violation => {
      if (!violation.created_at) return false;
      const violationDate = new Date(violation.created_at.toDate ? violation.created_at.toDate() : violation.created_at);
      return violationDate >= sevenDaysAgo;
    });
    
    // Sort recent violations by date (newest first) and limit to 10
    recentViolations.sort((a, b) => {
      const aDate = new Date(a.created_at.toDate ? a.created_at.toDate() : a.created_at);
      const bDate = new Date(b.created_at.toDate ? b.created_at.toDate() : b.created_at);
      return bDate - aDate;
    });
    
    // Get enforcer details for recent violations
    const recentViolationsWithEnforcer = await Promise.all(
      recentViolations.slice(0, 10).map(async (violation) => {
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
    
    // Get violations by enforcer
    const violationsByEnforcer = {};
    allViolations.forEach(violation => {
      if (violation.enforcer_id) {
        violationsByEnforcer[violation.enforcer_id] = (violationsByEnforcer[violation.enforcer_id] || 0) + 1;
      }
    });
    
    // Get top enforcers with names
    const topEnforcers = [];
    for (const [enforcerId, count] of Object.entries(violationsByEnforcer)) {
      const enforcer = await firebaseService.findById('users', enforcerId);
      if (enforcer) {
        topEnforcers.push({
          enforcer_name: enforcer.full_name,
          violation_count: count
        });
      }
    }
    topEnforcers.sort((a, b) => b.violation_count - a.violation_count);
    
    res.status(200).json({
      success: true,
      data: {
        totalViolations,
        violationsByStatus,
        monthlyData,
        totalEnforcers,
        activeEnforcers,
        totalFines,
        recentViolations: recentViolationsWithEnforcer, // Return array of recent violations with enforcer details
        violationsByEnforcer: topEnforcers.slice(0, 10)
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

// @desc    Get repeat offenders
// @route   GET /api/admin/repeat-offenders
// @access  Private (Admin only)
router.get('/repeat-offenders', async (req, res) => {
  try {
    const { min_violations = 2 } = req.query;
    const firebaseService = getFirebaseService();
    
    // Get all violations
    const allViolations = await firebaseService.getViolations({}, { limit: 10000 });
    
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
      }
    });
    
    // Find repeat offenders (based on min_violations parameter, default 2)
    const repeatOffenders = Object.entries(violatorGroups)
      .filter(([key, violations]) => violations.length >= parseInt(min_violations))
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
    
    res.status(200).json({
      success: true,
      data: {
        repeatOffenders,
        statistics
      }
    });
    
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

module.exports = router;