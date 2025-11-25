const express = require('express');
const { body, validationResult } = require('express-validator');
const { getFirebaseService } = require('../config/database');
const { generateViolationNumber } = require('../utils/violationNumberGenerator');
const { logAudit } = require('../utils/auditLogger');
const { sendSMS } = require('../services/smsService');

const router = express.Router();

const parseDeviceKeys = () => {
  const rawKeys = process.env.DEVICE_API_KEYS || process.env.DEVICE_API_KEY || '';

  return rawKeys
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [apiKey, deviceId] = entry.split(':').map((part) => part.trim());
      if (apiKey) {
        acc[apiKey] = deviceId || 'hardware';
      }
      return acc;
    }, {});
};

const authenticateDevice = (req, res, next) => {
  const deviceKeys = parseDeviceKeys();

  if (!Object.keys(deviceKeys).length) {
    console.error('Device route misconfigured: DEVICE_API_KEYS env variable is not set.');
    return res.status(503).json({
      success: false,
      error: 'Device integration is not configured',
    });
  }

  const apiKey =
    req.header('x-api-key') ||
    req.header('x-device-api-key') ||
    req.query.apiKey ||
    req.body.apiKey ||
    req.header('authorization');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing device API key',
    });
  }

  const sanitizedKey = apiKey.replace(/^Bearer\s+/i, '').trim();
  const deviceId = deviceKeys[sanitizedKey];

  if (!deviceId) {
    return res.status(403).json({
      success: false,
      error: 'Invalid device API key',
    });
  }

  req.device = {
    id: deviceId,
    apiKey: sanitizedKey,
  };

  // Prevent API key from leaking into downstream validators or persistence
  delete req.body.apiKey;

  next();
};

router.post(
  '/violations',
  authenticateDevice,
  [
    body('violator_name').trim().notEmpty().withMessage('Violator name is required'),
    body('violation_type').trim().notEmpty().withMessage('Violation type is required'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('fine_amount')
      .notEmpty()
      .withMessage('Fine amount is required')
      .bail()
      .isFloat({ min: 0 })
      .withMessage('Fine amount must be a positive number'),
    body('violator_phone')
      .optional({ checkFalsy: true })
      .isMobilePhone('any')
      .withMessage('Violator phone must be a valid mobile number'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
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

      // Create violation payload
      const violationPayload = {
        violation_number: violationNumber,
        enforcer_id: null, // Device violations don't have enforcer_id
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
        previous_violations_count: previousViolationsCount,
        captured_at: req.body.captured_at
          ? new Date(req.body.captured_at)
          : req.body.datetime
          ? new Date(req.body.datetime)
          : new Date(),
      };

      const violation = await firebaseService.createViolation(violationPayload);

      await logAudit(
        `device:${req.device.id}`,
        'DEVICE_CREATE_VIOLATION',
        'violations',
        violation.id,
        null,
        {
          violation_number: violationNumber,
          violator_name: req.body.violator_name,
          violator_license: req.body.violator_license || '',
        },
        req
      );

      return res.status(201).json({
        success: true,
        data: violation,
        message: 'Violation recorded successfully',
      });
    } catch (error) {
      console.error('Device violation creation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create violation record',
      });
    }
  }
);

module.exports = router;

