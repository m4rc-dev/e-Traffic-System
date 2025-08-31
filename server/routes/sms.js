const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { getSMSLogs, getSMSStats, sendSMS } = require('../services/smsService');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Get SMS logs
// @route   GET /api/sms/logs
// @access  Private (Admin only)
router.get('/logs', async (req, res) => {
  try {
    const { page, limit, status, phone_number } = req.query;
    
    const result = await getSMSLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      phone_number
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
    console.error('Get SMS logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get SMS statistics
// @route   GET /api/sms/stats
// @access  Private (Admin only)
router.get('/stats', async (req, res) => {
  try {
    const result = await getSMSStats();

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
    console.error('Get SMS stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Send test SMS
// @route   POST /api/sms/test
// @access  Private (Admin only)
router.post('/test', async (req, res) => {
  try {
    const { phone_number, message } = req.body;

    if (!phone_number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    const result = await sendSMS(phone_number, message);

    res.status(200).json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('Send test SMS error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
