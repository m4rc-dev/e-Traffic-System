const express = require('express');
const { body, validationResult } = require('express-validator');
const { getFirebaseService } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');
const { sendSMS } = require('../services/smsService');
const { generateViolationNumber } = require('../utils/violationNumberGenerator');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get all violations (simplified Firebase version)
// @route   GET /api/violations
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
        enforcer_id = '',
      violation_type = '',
      violator_name = '',
      repeat_offender = ''
    } = req.query;
    
    const firebaseService = getFirebaseService();
    
    // Ensure limit and page are valid numbers
    const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const validPage = Math.max(1, parseInt(page) || 1);
    const offset = (validPage - 1) * validLimit;
    
    // Build conditions for Firebase
    const conditions = {};
    
    if (status) {
      conditions.status = status;
    }
    
    if (enforcer_id) {
      conditions.enforcer_id = enforcer_id;
    }

    if (repeat_offender === 'true') {
      conditions.is_repeat_offender = true;
    } else if (repeat_offender === 'false') {
      conditions.is_repeat_offender = false;
    }

    const violationTypeFilterRaw = violation_type ? String(violation_type).trim() : '';
    const violatorNameFilterRaw = violator_name ? String(violator_name).trim() : '';
    const violationTypeFilter = violationTypeFilterRaw.toLowerCase();
    const violatorNameFilter = violatorNameFilterRaw.toLowerCase();
    const needsClientFiltering = Boolean(
      search ||
      violationTypeFilterRaw ||
      violatorNameFilterRaw
    );
    
    // Get violations (avoid composite index by fetching all and sorting in memory if needed)
    const firebaseOptions = {
      sortInMemory: Object.keys(conditions).length > 0
    };

    if (!needsClientFiltering) {
      firebaseOptions.limit = validLimit;
      firebaseOptions.offset = offset;
    }

    let violations = await firebaseService.getViolations(conditions, firebaseOptions);
    
    // Get enforcer details for each violation
    const violationsWithEnforcer = await Promise.all(
      violations.map(async (violation) => {
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
    
    violations = violationsWithEnforcer;
    
    // Apply client-side filtering for search
    let filteredViolations = violations;
    
    if (violatorNameFilter) {
      filteredViolations = filteredViolations.filter(violation =>
        violation.violator_name?.toLowerCase().includes(violatorNameFilter)
      );
    }
    
    if (violationTypeFilter) {
      filteredViolations = filteredViolations.filter(violation =>
        violation.violation_type?.toLowerCase().includes(violationTypeFilter)
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredViolations = filteredViolations.filter(violation => 
        violation.violator_name?.toLowerCase().includes(searchLower) ||
        violation.violator_license?.toLowerCase().includes(searchLower) ||
        violation.vehicle_plate?.toLowerCase().includes(searchLower) ||
        violation.violation_type?.toLowerCase().includes(searchLower) ||
        violation.location?.toLowerCase().includes(searchLower)
      );
    }

    let totalCount;
    let paginatedViolations = filteredViolations;
    let totalPages;
    let currentPage = validPage;

    if (needsClientFiltering) {
      totalCount = filteredViolations.length;
      totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / validLimit);
      if (totalPages === 0) {
        currentPage = 1;
      } else if (validPage > totalPages) {
        currentPage = totalPages;
      }
      const startIndex = (currentPage - 1) * validLimit;
      paginatedViolations = filteredViolations.slice(startIndex, startIndex + validLimit);
    } else {
      totalCount = await firebaseService.count('violations', conditions);
      totalPages = Math.ceil(totalCount / validLimit);
      if (totalPages === 0) {
        currentPage = 1;
      } else if (validPage > totalPages) {
        currentPage = totalPages;
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        violations: paginatedViolations,
        pagination: {
          current: currentPage,
          total: totalPages,
          totalRecords: totalCount
        }
      }
    });
    
  } catch (error) {
    console.error('Get violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load violations'
    });
  }
});

// @desc    Get single violation
// @route   GET /api/violations/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseService = getFirebaseService();
    
    const violation = await firebaseService.findById('violations', id);
    
    if (!violation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }
    
    // Get enforcer info
    if (violation.enforcer_id) {
      const enforcer = await firebaseService.findById('users', violation.enforcer_id);
      violation.enforcer_name = enforcer ? enforcer.full_name : 'Unknown';
    }
    
    res.status(200).json({
      success: true,
      data: violation
    });
    
  } catch (error) {
    console.error('Get violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load violation'
    });
  }
});

// @desc    Create new violation
// @route   POST /api/violations
// @access  Private (Enforcer and Admin)
router.post('/', [
  authorize('enforcer', 'admin'),
  body('violator_name').notEmpty().withMessage('Violator name is required'),
  body('violation_type').notEmpty().withMessage('Violation type is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('fine_amount').isNumeric().withMessage('Fine amount must be a number')
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
    
    // Generate violation number
    const violationNumber = await generateViolationNumber();
    
    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    // Create violation
    const violation = await firebaseService.createViolation({
      violation_number: violationNumber,
      enforcer_id: req.user.id,
      violator_name: req.body.violator_name,
      violator_license: req.body.violator_license || '',
      violator_phone: req.body.violator_phone || '',
      violator_address: req.body.violator_address || '',
      vehicle_plate: req.body.vehicle_plate || '',
      vehicle_model: req.body.vehicle_model || '',
      vehicle_color: req.body.vehicle_color || '',
      violation_type: req.body.violation_type,
      violation_description: req.body.violation_description || '',
      location: req.body.location,
      latitude: req.body.latitude || null,
      longitude: req.body.longitude || null,
      fine_amount: parseFloat(req.body.fine_amount),
      status: 'pending',
      evidence_photos: req.body.evidence_photos || [],
      notes: req.body.notes || '',
      due_date: dueDate
    });

    // Log audit
    await logAudit(
      req.user.id,
      'CREATE_VIOLATION',
      'violations',
      violation.id,
      null,
      { violation_number: violationNumber, violator_name: req.body.violator_name },
      req
    );

    res.status(201).json({
      success: true,
      data: violation,
      message: 'Violation created successfully'
    });

  } catch (error) {
    console.error('Create violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create violation'
    });
  }
});

// @desc    Update violation
// @route   PUT /api/violations/:id
// @access  Private (Enforcer and Admin)
router.put('/:id', [
  authorize('enforcer', 'admin'),
  body('violator_name').optional().notEmpty().withMessage('Violator name cannot be empty'),
  body('violation_type').optional().notEmpty().withMessage('Violation type cannot be empty'),
  body('location').optional().notEmpty().withMessage('Location cannot be empty'),
  body('fine_amount').optional().isNumeric().withMessage('Fine amount must be a number'),
  body('status').optional().isIn(['pending', 'issued', 'paid', 'disputed', 'cancelled']).withMessage('Invalid status')
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
    const firebaseService = getFirebaseService();
    
    // Get current violation
    const currentViolation = await firebaseService.findById('violations', id);
    if (!currentViolation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    // Check if user can update this violation
    if (req.user.role === 'enforcer' && currentViolation.enforcer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own violations'
      });
    }

    // Update violation
    const updatedViolation = await firebaseService.updateViolation(id, req.body);

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE_VIOLATION',
      'violations',
      id,
      currentViolation,
      req.body,
      req
    );

    res.status(200).json({
      success: true,
      data: updatedViolation,
      message: 'Violation updated successfully'
    });

  } catch (error) {
    console.error('Update violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update violation'
    });
  }
});

// @desc    Delete violation
// @route   DELETE /api/violations/:id
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseService = getFirebaseService();
    
    // Get violation
    const violation = await firebaseService.findById('violations', id);
    if (!violation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    // Delete violation
    await firebaseService.deleteViolation(id);

    // Log audit
    await logAudit(
      req.user.id,
      'DELETE_VIOLATION',
      'violations',
      id,
      violation,
      null,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Violation deleted successfully'
    });

  } catch (error) {
    console.error('Delete violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete violation'
    });
  }
});

module.exports = router;