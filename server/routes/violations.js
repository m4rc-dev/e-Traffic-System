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
    
    if (violation_type) {
      conditions.violation_type = violation_type;
    }
    
    if (repeat_offender !== '') {
      conditions.is_repeat_offender = repeat_offender === 'true';
    }
    
    // For search, we'll need to filter in memory since Firebase doesn't support full-text search
    const allViolations = await firebaseService.getViolations(conditions);
    
    // Apply search filters in memory
    let filteredViolations = allViolations;
    
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredViolations = filteredViolations.filter(violation => 
        (violation.violation_number && violation.violation_number.toLowerCase().includes(searchTerm)) ||
        (violation.violator_name && violation.violator_name.toLowerCase().includes(searchTerm)) ||
        (violation.vehicle_plate && violation.vehicle_plate.toLowerCase().includes(searchTerm))
      );
    }
    
    if (violator_name) {
      const searchTerm = violator_name.toLowerCase();
      filteredViolations = filteredViolations.filter(violation => 
        violation.violator_name && violation.violator_name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort by created_at descending (newest first)
    filteredViolations.sort((a, b) => {
      const aDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
      const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
      return bDate - aDate;
    });
    
    // Apply pagination
    const paginatedViolations = filteredViolations.slice(offset, offset + validLimit);
    
    // Get enforcer details for each violation
    const violationsWithEnforcer = await Promise.all(
      paginatedViolations.map(async (violation) => {
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
        violations: violationsWithEnforcer,
        pagination: {
          current: validPage,
          total: Math.ceil(filteredViolations.length / validLimit),
          totalRecords: filteredViolations.length
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
    
    // Get enforcer details if exists
    if (violation.enforcer_id) {
      try {
        const enforcer = await firebaseService.findById('users', violation.enforcer_id);
        violation.enforcer_name = enforcer ? enforcer.full_name : 'Unknown';
        violation.enforcer_badge = enforcer ? enforcer.badge_number : 'Unknown';
      } catch (error) {
        console.error(`Error fetching enforcer for violation ${violation.id}:`, error);
        violation.enforcer_name = 'Unknown';
        violation.enforcer_badge = 'Unknown';
      }
    } else {
      violation.enforcer_name = 'Unknown';
      violation.enforcer_badge = 'Unknown';
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
    
    // Check if violator is a repeat offender by looking for existing violations
    // with the same license number
    let isRepeatOffender = false;
    let previousViolationsCount = 0;
    
    if (req.body.violator_license) {
      // Find existing violations with the same license number
      const existingViolations = await firebaseService.getViolations({
        violator_license: req.body.violator_license
      });
      
      if (existingViolations && existingViolations.length > 0) {
        isRepeatOffender = true;
        previousViolationsCount = existingViolations.length;
      }
    }
    
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
      fine_amount: parseFloat(req.body.fine_amount),
      status: 'pending',
      notes: req.body.notes || '',
      due_date: dueDate,
      is_repeat_offender: isRepeatOffender,
      previous_violations_count: previousViolationsCount
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

    // Check if status was updated to 'issued' and send penalty reminder if overdue
    if (req.body.status === 'issued' && currentViolation.status !== 'issued') {
      // Check if violation is overdue (more than 7 days past due date)
      if (currentViolation.due_date && currentViolation.violator_phone) {
        const dueDate = currentViolation.due_date.toDate ? 
          currentViolation.due_date.toDate() : 
          new Date(currentViolation.due_date);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        // If overdue by more than 7 days, send penalty reminder
        if (daysOverdue > 7) {
          const { sendSMS } = require('../services/smsService');
          
          // Create penalty reminder message (simplified to avoid spam filters)
          const message = `Traffic Violation Reminder\n\n` +
            `Violation: ${currentViolation.violation_type}\n` +
            `Plate: ${currentViolation.vehicle_plate}\n` +
            `Fine: ₱${currentViolation.fine_amount}\n` +
            `Due: ${dueDate.toLocaleDateString()}\n\n` +
            `Please settle at city transport office to avoid penalties.\n` +
            `Ref: ${currentViolation.violation_number}`;
          
          // Send SMS in the background (don't wait for result)
          sendSMS(currentViolation.violator_phone, message, id)
            .then(result => {
              if (result.success) {
                console.log(`✅ Penalty reminder sent for violation ${currentViolation.violation_number}`);
              } else {
                console.log(`❌ Failed to send penalty reminder for violation ${currentViolation.violation_number}: ${result.message}`);
              }
            })
            .catch(error => {
              console.error(`❌ Error sending penalty reminder for violation ${currentViolation.violation_number}:`, error.message);
            });
        }
      }
    }

    // Check if client requested to send penalty reminder
    if (req.body.sendPenaltyReminder) {
      // Check if violation has necessary data
      if (currentViolation.violator_phone && currentViolation.due_date) {
        const { sendSMS } = require('../services/smsService');
        
        // Get due date
        const dueDate = currentViolation.due_date.toDate ? 
          currentViolation.due_date.toDate() : 
          new Date(currentViolation.due_date);
        
        // Create penalty reminder message (simplified to avoid spam filters)
        const message = `Traffic Violation Reminder\n\n` +
          `Violation: ${currentViolation.violation_type}\n` +
          `Plate: ${currentViolation.vehicle_plate}\n` +
          `Fine: ₱${currentViolation.fine_amount}\n` +
          `Due: ${dueDate.toLocaleDateString()}\n\n` +
          `Please settle at city transport office to avoid penalties.\n` +
          `Ref: ${currentViolation.violation_number}`;
        
        // Send SMS in the background (don't wait for result)
        sendSMS(currentViolation.violator_phone, message, id)
          .then(result => {
            if (result.success) {
              console.log(`✅ Penalty reminder sent for violation ${currentViolation.violation_number}`);
            } else {
              console.log(`❌ Failed to send penalty reminder for violation ${currentViolation.violation_number}: ${result.message}`);
            }
          })
          .catch(error => {
            console.error(`❌ Error sending penalty reminder for violation ${currentViolation.violation_number}:`, error.message);
          });
      }
    }

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

// @desc    Send SMS notification for a violation
// @route   POST /api/violations/:id/send-sms
// @access  Private (Admin only)
router.post('/:id/send-sms', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const firebaseService = getFirebaseService();
    
    // Get violation
    const violation = await firebaseService.findById('violations', id);
    if (!violation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }
    
    // Check if violator has a phone number
    if (!violation.violator_phone) {
      return res.status(400).json({
        success: false,
        error: 'No phone number available for this violator'
      });
    }
    
    // Send SMS
    const smsResult = await sendSMS(violation.violator_phone, message, id);
    
    if (smsResult.success) {
      // Log audit
      await logAudit(
        req.user.id,
        'SEND_SMS',
        'violations',
        id,
        null,
        { message, phone_number: violation.violator_phone },
        req
      );
      
      return res.status(200).json({
        success: true,
        message: 'SMS sent successfully',
        data: smsResult
      });
    } else {
      return res.status(500).json({
        success: false,
        error: smsResult.message || 'Failed to send SMS'
      });
    }
  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS'
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