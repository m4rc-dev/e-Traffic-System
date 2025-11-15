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
    body('latitude').optional({ nullable: true }).isFloat().withMessage('Latitude must be a number'),
    body('longitude').optional({ nullable: true }).isFloat().withMessage('Longitude must be a number'),
    body('send_sms')
      .optional()
      .isBoolean()
      .withMessage('send_sms must be a boolean value')
      .toBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array(),
      });
    }

    try {
      const firebaseService = getFirebaseService();
      const violationNumber = await generateViolationNumber();

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const violationPayload = {
        violation_number: violationNumber,
        enforcer_id: null,
        recorded_by_device: req.device.id,
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
        latitude: req.body.latitude ?? null,
        longitude: req.body.longitude ?? null,
        fine_amount: parseFloat(req.body.fine_amount),
        status: 'pending',
        evidence_photos: Array.isArray(req.body.evidence_photos) ? req.body.evidence_photos : [],
        notes: req.body.notes || '',
        due_date: dueDate,
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
          recorded_by_device: req.device.id,
        },
        req
      );

      let smsResult = null;
      const shouldSendSms =
        typeof req.body.send_sms === 'boolean'
          ? req.body.send_sms
          : req.body.send_sms === 'true';

      if (shouldSendSms && violation.violator_phone) {
        const smsMessage =
          req.body.sms_message ||
          `Traffic violation ${violationNumber} recorded. Fine amount: ${violation.fine_amount}. Please resolve within 30 days.`;

        smsResult = await sendSMS(violation.violator_phone, smsMessage, violation.id);
      }

      return res.status(201).json({
        success: true,
        data: violation,
        message: 'Violation recorded successfully',
        sms: smsResult,
      });
    } catch (error) {
      console.error('Device violation creation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to record violation',
      });
    }
  }
);

module.exports = router;

