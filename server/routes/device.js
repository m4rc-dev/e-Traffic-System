const express = require('express');
const { body, validationResult } = require('express-validator');
const { getFirebaseService } = require('../config/database');
const { generateViolationNumber } = require('../utils/violationNumberGenerator');
const { logAudit } = require('../utils/auditLogger');
const { sendSMS } = require('../services/smsService');

const router = express.Router();

/**
 * Parse ESP32 datetime format (e.g., "12-4-25 14.30.0" -> Date object)
 * Format: MM-D-YY HH.MM.SS (with dots instead of colons)
 * @param {string} dateTimeStr - The datetime string from ESP32
 * @returns {Date|null} - Valid Date object or null if parsing fails
 */
const parseESP32DateTime = (dateTimeStr) => {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return null;
  }

  try {
    // Clean the string
    const cleaned = dateTimeStr.trim();

    // Pattern: "12-4-25 14.30.0" -> [date, time]
    const parts = cleaned.split(' ');
    if (parts.length !== 2) {
      console.log('ESP32 DateTime parse failed: Invalid format (expected date time)', dateTimeStr);
      return null;
    }

    const [datePart, timePart] = parts;

    // Parse date: "12-4-25" -> month=12, day=4, year=25
    const datePieces = datePart.split('-');
    if (datePieces.length !== 3) {
      console.log('ESP32 DateTime parse failed: Invalid date format', datePart);
      return null;
    }

    let [month, day, year] = datePieces.map(Number);

    // Handle 2-digit year (25 -> 2025)
    if (year < 100) {
      year += 2000;
    }

    // Parse time: "14.30.0" -> hours=14, minutes=30, seconds=0
    const timePieces = timePart.split('.');
    if (timePieces.length < 2) {
      console.log('ESP32 DateTime parse failed: Invalid time format', timePart);
      return null;
    }

    const hours = parseInt(timePieces[0], 10);
    const minutes = parseInt(timePieces[1], 10);
    const seconds = timePieces.length > 2 ? parseInt(timePieces[2], 10) : 0;

    // Create date object (months are 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    // Validate the date
    if (isNaN(date.getTime())) {
      console.log('ESP32 DateTime parse failed: Invalid date result', dateTimeStr);
      return null;
    }

    console.log(`ESP32 DateTime parsed: "${dateTimeStr}" -> ${date.toISOString()}`);
    return date;
  } catch (error) {
    console.error('ESP32 DateTime parse error:', error, dateTimeStr);
    return null;
  }
};

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

      // Calculate due date (3 days from now - Cebu City compliance period)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

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
        vehicle_brand: req.body.vehicle_brand || '',
        vehicle_model: req.body.vehicle_model || '',
        vehicle_variant: req.body.vehicle_variant || '',
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
            ? (parseESP32DateTime(req.body.datetime) || new Date())
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

