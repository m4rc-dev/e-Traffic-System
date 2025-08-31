const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { protect, authorize } = require('../middleware/auth');
const { sendSMS } = require('../services/smsService');
const { generateViolationNumber } = require('../utils/violationNumberGenerator');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get all violations (with filtering and pagination)
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
      start_date = '',
      end_date = '',
      violation_type = ''
    } = req.query;
    
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
    let whereClause = 'WHERE 1=1';
    let params = [];

    // Search filter
    if (search) {
      whereClause += ' AND (v.violator_name LIKE ? OR v.vehicle_plate LIKE ? OR v.violation_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Status filter
    if (status) {
      whereClause += ' AND v.status = ?';
      params.push(status);
    }

    // Enforcer filter (admin can see all, enforcers see only their own)
    if (req.user.role === 'enforcer') {
      whereClause += ' AND v.enforcer_id = ?';
      params.push(req.user.id);
    } else if (enforcer_id) {
      whereClause += ' AND v.enforcer_id = ?';
      params.push(enforcer_id);
    }

    // Date range filter
    if (start_date) {
      whereClause += ' AND DATE(v.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(v.created_at) <= ?';
      params.push(end_date);
    }

    // Violation type filter
    if (violation_type) {
      whereClause += ' AND v.violation_type = ?';
      params.push(violation_type);
    }

    // Aggressive debugging
    console.log('=== VIOLATIONS DEBUG START ===');
    console.log('req.query:', req.query);
    console.log('page:', page, 'limit:', limit);
    console.log('validLimit:', validLimit, 'type:', typeof validLimit);
    console.log('validPage:', validPage, 'type:', typeof validPage);
    console.log('offset:', offset, 'type:', typeof offset);
    console.log('params array:', params);
    console.log('final params array:', [...params, validLimit, offset]);
    console.log('=== VIOLATIONS DEBUG END ===');
    
    // Get violations with enforcer info
    const violations = await query(`
      SELECT 
        v.*,
        u.full_name as enforcer_name,
        u.badge_number as enforcer_badge
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, validLimit, offset]);

    // Get total count
    const [totalCount] = await query(`
      SELECT COUNT(*) as count 
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      ${whereClause}
    `, params);

    res.status(200).json({
      success: true,
      data: {
        violations,
        pagination: {
          current: validPage,
          total: Math.ceil(totalCount.count / validLimit),
          totalRecords: totalCount.count
        }
      }
    });

  } catch (error) {
    console.error('Get violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Export violations to CSV
// @route   GET /api/violations/export
// @access  Private
router.get('/export', async (req, res) => {
  try {
    const { 
      search = '', 
      status = '', 
      enforcer_id = '',
      start_date = '',
      end_date = '',
      violation_type = '',
      format = 'csv'
    } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    // Search filter
    if (search) {
      whereClause += ' AND (v.violator_name LIKE ? OR v.vehicle_plate LIKE ? OR v.violation_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Status filter
    if (status) {
      whereClause += ' AND v.status = ?';
      params.push(status);
    }

    // Enforcer filter (admin can see all, enforcers see only their own)
    if (req.user.role === 'enforcer') {
      whereClause += ' AND v.enforcer_id = ?';
      params.push(req.user.id);
    } else if (enforcer_id) {
      whereClause += ' AND v.enforcer_id = ?';
      params.push(enforcer_id);
    }

    // Date range filter
    if (start_date) {
      whereClause += ' AND DATE(v.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(v.created_at) <= ?';
      params.push(end_date);
    }

    // Violation type filter
    if (violation_type) {
      whereClause += ' AND v.violation_type = ?';
      params.push(violation_type);
    }

    // Get violations for export
    const violations = await query(`
      SELECT 
        v.violation_number,
        v.violator_name,
        v.violator_phone,
        v.vehicle_plate,
        v.vehicle_model,
        v.vehicle_color,
        v.violation_type,
        v.location,
        v.fine_amount,
        v.status,
        v.created_at,
        v.due_date,
        v.paid_at,
        u.full_name as enforcer_name,
        u.badge_number as enforcer_badge
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      ${whereClause}
      ORDER BY v.created_at DESC
    `, params);

    if (format === 'csv') {
      // Create CSV headers
      const csvHeaders = [
        'Violation Number',
        'Violator Name',
        'Phone Number',
        'Vehicle Plate',
        'Vehicle Model',
        'Vehicle Color',
        'Violation Type',
        'Location',
        'Fine Amount (₱)',
        'Status',
        'Date Created',
        'Due Date',
        'Paid Date',
        'Enforcer Name',
        'Badge Number'
      ];

      // Convert data to CSV format
      const csvData = violations.map(violation => [
        violation.violation_number || '',
        violation.violator_name || '',
        violation.violator_phone || '',
        violation.vehicle_plate || '',
        violation.vehicle_model || '',
        violation.vehicle_color || '',
        violation.violation_type || '',
        violation.location || '',
        violation.fine_amount || '0',
        violation.status || '',
        violation.created_at ? new Date(violation.created_at).toLocaleDateString() : '',
        violation.due_date ? new Date(violation.due_date).toLocaleDateString() : '',
        violation.paid_at ? new Date(violation.paid_at).toLocaleDateString() : '',
        violation.enforcer_name || '',
        violation.enforcer_badge || ''
      ]);

      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Set headers for file download
      const filename = `violations_export_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      
      return res.send(csvContent);
    }

    // Default JSON export
    res.status(200).json({
      success: true,
      data: violations,
      count: violations.length,
      exported_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Export violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during export'
    });
  }
});

// @desc    Get single violation
// @route   GET /api/violations/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let whereClause = 'WHERE v.id = ?';
    let params = [id];

    // Enforcers can only view their own violations
    if (req.user.role === 'enforcer') {
      whereClause += ' AND v.enforcer_id = ?';
      params.push(req.user.id);
    }

    const violations = await query(`
      SELECT 
        v.*,
        u.full_name as enforcer_name,
        u.badge_number as enforcer_badge
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      ${whereClause}
    `, params);

    if (violations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: violations[0]
    });

  } catch (error) {
    console.error('Get violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Create new violation (IoT device endpoint)
// @route   POST /api/violations
// @access  Private (Enforcers only)
router.post('/', [
  authorize('enforcer'),
  body('violator_name').notEmpty().withMessage('Violator name is required'),
  body('violation_type').notEmpty().withMessage('Violation type is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('fine_amount').isFloat({ min: 0 }).withMessage('Fine amount must be a positive number'),
  body('vehicle_plate').optional().notEmpty().withMessage('Vehicle plate cannot be empty'),
  body('violator_phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('latitude').optional().isFloat().withMessage('Latitude must be a valid number'),
  body('longitude').optional().isFloat().withMessage('Longitude must be a valid number')
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

    const {
      violator_name,
      violator_license,
      violator_phone,
      violator_address,
      vehicle_plate,
      vehicle_model,
      vehicle_color,
      violation_type,
      violation_description,
      location,
      latitude,
      longitude,
      fine_amount,
      evidence_photos,
      notes
    } = req.body;

    // Generate unique violation number with Philippine format
    const violationNumber = generateViolationNumber();

    // Calculate due date (30 days from now by default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create violation
    const result = await query(`
      INSERT INTO violations (
        violation_number, enforcer_id, violator_name, violator_license, 
        violator_phone, violator_address, vehicle_plate, vehicle_model, 
        vehicle_color, violation_type, violation_description, location, 
        latitude, longitude, fine_amount, evidence_photos, notes, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      violationNumber, req.user.id, violator_name, violator_license,
      violator_phone, violator_address, vehicle_plate, vehicle_model,
      vehicle_color, violation_type, violation_description, location,
      latitude, longitude, fine_amount, 
      evidence_photos ? JSON.stringify(evidence_photos) : null,
      notes, dueDate
    ]);

    // Get created violation
    const [newViolation] = await query(`
      SELECT 
        v.*,
        u.full_name as enforcer_name,
        u.badge_number as enforcer_badge
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      WHERE v.id = ?
    `, [result.insertId]);

    // Send SMS notification if phone number is provided
    if (violator_phone) {
      try {
        const message = `Traffic Violation Notice: You have been issued a violation ticket (${violationNumber}) for ${violation_type}. Fine amount: ₱${fine_amount}. Due date: ${dueDate.toLocaleDateString()}. Please contact the traffic department for payment.`;
        
        await sendSMS(violator_phone, message, result.insertId);
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Don't fail the request if SMS fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Violation created successfully',
      data: newViolation
    });

  } catch (error) {
    console.error('Create violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Update violation
// @route   PUT /api/violations/:id
// @access  Private
router.put('/:id', [
  body('status').optional().isIn(['pending', 'issued', 'paid', 'disputed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().notEmpty().withMessage('Notes cannot be empty')
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
    const { status, notes } = req.body;

    // Check if violation exists and user has access
    let whereClause = 'WHERE id = ?';
    let params = [id];

    if (req.user.role === 'enforcer') {
      whereClause += ' AND enforcer_id = ?';
      params.push(req.user.id);
    }

    const [existingViolation] = await query(
      `SELECT * FROM violations ${whereClause}`,
      params
    );

    if (!existingViolation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
      
      // If status is paid, set paid_at timestamp
      if (status === 'paid') {
        updateFields.push('paid_at = NOW()');
      }
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateValues.push(id);

    // Update violation
    await query(`
      UPDATE violations 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // Get updated violation
    const [updatedViolation] = await query(`
      SELECT 
        v.*,
        u.full_name as enforcer_name,
        u.badge_number as enforcer_badge
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      WHERE v.id = ?
    `, [id]);

    res.status(200).json({
      success: true,
      message: 'Violation updated successfully',
      data: updatedViolation
    });

  } catch (error) {
    console.error('Update violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Delete violation (Admin only)
// @route   DELETE /api/violations/:id
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if violation exists
    const [existingViolation] = await query(
      'SELECT id FROM violations WHERE id = ?',
      [id]
    );

    if (!existingViolation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    // Delete violation
    await query('DELETE FROM violations WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Violation deleted successfully'
    });

  } catch (error) {
    console.error('Delete violation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});
// @route   GET /api/violations/stats/overview
// @access  Private
router.get('/stats/overview', async (req, res) => {
  try {
    let whereClause = '';
    let params = [];

    // Enforcers can only see their own stats
    if (req.user.role === 'enforcer') {
      whereClause = 'WHERE enforcer_id = ?';
      params.push(req.user.id);
    }

    // Get total violations
    const [totalViolations] = await query(
      `SELECT COUNT(*) as count FROM violations ${whereClause}`,
      params
    );

    // Get violations by status
    const violationsByStatus = await query(`
      SELECT status, COUNT(*) as count 
      FROM violations 
      ${whereClause}
      GROUP BY status
    `, params);

    // Get total fines
    const [totalFines] = await query(`
      SELECT COALESCE(SUM(fine_amount), 0) as total 
      FROM violations 
      ${whereClause}
    `, params);

    // Get collected fines
    const [collectedFines] = await query(`
      SELECT COALESCE(SUM(fine_amount), 0) as total 
      FROM violations 
      ${whereClause} AND status = 'paid'
    `, params);

    // Get violations by type
    const violationsByType = await query(`
      SELECT violation_type, COUNT(*) as count 
      FROM violations 
      ${whereClause}
      GROUP BY violation_type
      ORDER BY count DESC
      LIMIT 10
    `, params);

    res.status(200).json({
      success: true,
      data: {
        totalViolations: totalViolations.count,
        violationsByStatus,
        totalFines: parseFloat(totalFines.total),
        collectedFines: parseFloat(collectedFines.total),
        violationsByType
      }
    });

  } catch (error) {
    console.error('Get violation stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get violation types for dropdown
// @route   GET /api/violations/types
// @access  Private
router.get('/types', async (req, res) => {
  try {
    let whereClause = '';
    let params = [];

    // Enforcers can only see types from their violations
    if (req.user.role === 'enforcer') {
      whereClause = 'WHERE enforcer_id = ?';
      params.push(req.user.id);
    }

    const violationTypes = await query(`
      SELECT DISTINCT violation_type as type, COUNT(*) as count
      FROM violations 
      ${whereClause}
      GROUP BY violation_type
      ORDER BY count DESC
    `, params);

    res.status(200).json({
      success: true,
      data: violationTypes
    });

  } catch (error) {
    console.error('Get violation types error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Bulk update violations status
// @route   PATCH /api/violations/bulk-update
// @access  Private
router.patch('/bulk-update', [
  body('violation_ids').isArray().withMessage('Violation IDs must be an array'),
  body('status').isIn(['pending', 'issued', 'paid', 'disputed', 'cancelled']).withMessage('Invalid status'),
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

    const { violation_ids, status } = req.body;

    if (!violation_ids || violation_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No violations selected'
      });
    }

    // Check permissions for enforcers
    let whereClause = `WHERE id IN (${violation_ids.map(() => '?').join(',')})`;
    let params = [...violation_ids];

    if (req.user.role === 'enforcer') {
      whereClause += ' AND enforcer_id = ?';
      params.push(req.user.id);
    }

    // Get violations to update
    const violations = await query(`SELECT id FROM violations ${whereClause}`, params);

    if (violations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No violations found to update'
      });
    }

    const validIds = violations.map(v => v.id);
    
    // Prepare update query
    let updateQuery = 'UPDATE violations SET status = ?';
    let updateParams = [status];
    
    if (status === 'paid') {
      updateQuery += ', paid_at = NOW()';
    }
    
    updateQuery += ` WHERE id IN (${validIds.map(() => '?').join(',')})`;
    updateParams.push(...validIds);

    // Execute bulk update
    const result = await query(updateQuery, updateParams);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.affectedRows} violations`,
      updated_count: result.affectedRows
    });

  } catch (error) {
    console.error('Bulk update violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during bulk update'
    });
  }
});

// @desc    Bulk delete violations (Admin only)
// @route   DELETE /api/violations/bulk-delete
// @access  Private (Admin only)
router.delete('/bulk-delete', [
  authorize('admin'),
  body('violation_ids').isArray().withMessage('Violation IDs must be an array')
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

    const { violation_ids } = req.body;

    if (!violation_ids || violation_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No violations selected'
      });
    }

    // Check if violations exist
    const whereClause = `WHERE id IN (${violation_ids.map(() => '?').join(',')})`;
    const violations = await query(`SELECT id FROM violations ${whereClause}`, violation_ids);

    if (violations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No violations found to delete'
      });
    }

    const validIds = violations.map(v => v.id);
    
    // Execute bulk delete
    const result = await query(
      `DELETE FROM violations WHERE id IN (${validIds.map(() => '?').join(',')})`,
      validIds
    );

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.affectedRows} violations`,
      deleted_count: result.affectedRows
    });

  } catch (error) {
    console.error('Bulk delete violations error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during bulk delete'
    });
  }
});

module.exports = router;
