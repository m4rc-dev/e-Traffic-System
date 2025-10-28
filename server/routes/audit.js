const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { getAuditLogs, getAuditStats } = require('../utils/auditLogger');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Get audit logs with pagination and filtering
// @route   GET /api/audit/logs
// @access  Private (Admin only)
router.get('/logs', async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      userId, 
      action, 
      tableName, 
      startDate, 
      endDate 
    } = req.query;

    const result = await getAuditLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      userId,
      action,
      tableName,
      startDate,
      endDate
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get audit statistics
// @route   GET /api/audit/stats
// @access  Private (Admin only)
router.get('/stats', async (req, res) => {
  try {
    const result = await getAuditStats();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get audit log details by ID
// @route   GET /api/audit/logs/:id
// @access  Private (Admin only)
router.get('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [auditLog] = await query(`
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?
    `, [id]);

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    res.status(200).json({
      success: true,
      data: auditLog
    });

  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get recent audit activity (last 24 hours)
// @route   GET /api/audit/recent
// @access  Private (Admin only)
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recentLogs = await query(`
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY al.created_at DESC
      LIMIT ${parseInt(limit)}
    `);

    res.status(200).json({
      success: true,
      data: recentLogs
    });

  } catch (error) {
    console.error('Get recent audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get audit logs by user
// @route   GET /api/audit/user/:userId
// @access  Private (Admin only)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await getAuditLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      userId
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
