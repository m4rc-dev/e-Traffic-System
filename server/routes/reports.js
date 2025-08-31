const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { query } = require('../config/database');
const moment = require('moment');
const { generateViolationNumber } = require('../utils/violationNumberGenerator');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Test database connection and tables
// @route   GET /api/reports/test-db
// @access  Private (Admin only)
router.get('/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const testConnection = await query('SELECT 1 as test, NOW() as current_time, DATABASE() as database_name');
    console.log('Basic connection test:', testConnection);
    
    // Check if users table exists
    const usersTable = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'users'
    `);
    console.log('Users table check:', usersTable);
    
    // Check if violations table exists
    const violationsTable = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'violations'
    `);
    console.log('Violations table check:', violationsTable);
    
    // Check user count and roles
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const usersByRole = await query('SELECT role, COUNT(*) as count, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count FROM users GROUP BY role');
    console.log('User count:', userCount);
    console.log('Users by role:', usersByRole);
    
    // Check violations count and recent data
    const violationsCount = await query('SELECT COUNT(*) as count FROM violations');
    const violationsByStatus = await query('SELECT status, COUNT(*) as count FROM violations GROUP BY status');
    const recentViolations = await query('SELECT COUNT(*) as count FROM violations WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)');
    const todayViolations = await query('SELECT COUNT(*) as count FROM violations WHERE DATE(created_at) = CURDATE()');
    
    console.log('Violations count:', violationsCount);
    console.log('Violations by status:', violationsByStatus);
    console.log('Recent violations (7 days):', recentViolations);
    console.log('Today violations:', todayViolations);
    
    // Check enforcers with details
    const enforcers = await query(`
      SELECT 
        u.id, 
        u.full_name, 
        u.badge_number,
        u.email,
        u.role, 
        u.is_active,
        u.created_at,
        COUNT(v.id) as total_violations,
        COUNT(CASE WHEN DATE(v.created_at) = CURDATE() THEN 1 END) as today_violations
      FROM users u 
      LEFT JOIN violations v ON u.id = v.enforcer_id
      WHERE u.role = "enforcer" 
      GROUP BY u.id, u.full_name, u.badge_number, u.email, u.role, u.is_active, u.created_at
      ORDER BY u.is_active DESC, total_violations DESC
    `);
    console.log('Enforcers with stats:', enforcers);
    
    // Sample violations if they exist
    const sampleViolations = await query(`
      SELECT 
        v.id, 
        v.violation_number, 
        v.enforcer_id, 
        v.violator_name, 
        v.violation_type,
        v.fine_amount, 
        v.status, 
        v.created_at,
        u.full_name as enforcer_name,
        u.badge_number as enforcer_badge
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      ORDER BY v.created_at DESC 
      LIMIT 5
    `);
    console.log('Sample violations:', sampleViolations);
    
    // Test enforcer performance query
    let enforcerTestResult = null;
    try {
      const testEnforcerQuery = `
        SELECT 
          u.id,
          u.full_name,
          u.badge_number,
          COALESCE(COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END), 0) as total_violations,
          COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN v.fine_amount ELSE 0 END), 0) as total_fines
        FROM users u
        LEFT JOIN violations v ON u.id = v.enforcer_id
        WHERE u.role = 'enforcer' AND u.is_active = TRUE
        GROUP BY u.id, u.full_name, u.badge_number
        ORDER BY total_violations DESC
        LIMIT 3
      `;
      
      enforcerTestResult = await query(testEnforcerQuery);
      console.log('Enforcer performance test query result:', enforcerTestResult);
    } catch (enforcerTestError) {
      console.error('Enforcer performance test query failed:', enforcerTestError);
      enforcerTestResult = { error: enforcerTestError.message };
    }
    
    // Database size and performance info
    const tableInfo = await query(`
      SELECT 
        table_name,
        table_rows,
        data_length,
        index_length,
        (data_length + index_length) as total_size
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name IN ('users', 'violations', 'sms_logs', 'audit_logs')
    `);
    console.log('Table information:', tableInfo);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        connection: 'OK',
        database_info: {
          name: testConnection[0].database_name,
          current_time: testConnection[0].current_time
        },
        tables: {
          users_table_exists: usersTable[0].count > 0,
          violations_table_exists: violationsTable[0].count > 0
        },
        users: {
          total_count: userCount[0].count,
          by_role: usersByRole,
          enforcers_detailed: enforcers
        },
        violations: {
          total_count: violationsCount[0].count,
          by_status: violationsByStatus,
          recent_7_days: recentViolations[0].count,
          today_count: todayViolations[0].count,
          sample_violations: sampleViolations
        },
        performance_tests: {
          enforcer_query_test: enforcerTestResult
        },
        table_statistics: tableInfo,
        recommendations: [
          enforcers.length === 0 ? 'No enforcers found. Create enforcer accounts to test the system.' : null,
          violationsCount[0].count === 0 ? 'No violations found. Use the create-sample-data endpoint to add test data.' : null,
          enforcers.filter(e => e.is_active).length === 0 ? 'No active enforcers found. Activate enforcer accounts.' : null
        ].filter(Boolean)
      }
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: 'Database test failed: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Create sample violations for testing
// @route   POST /api/reports/create-sample-data
// @access  Private (Admin only)
router.post('/create-sample-data', async (req, res) => {
  try {
    console.log('Creating sample data for testing...');
    
    // Get enforcers
    const enforcers = await query('SELECT id, full_name FROM users WHERE role = "enforcer" AND is_active = TRUE');
    
    if (enforcers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No enforcers found. Please create enforcer accounts first.'
      });
    }
    
    // Sample violation data
    const sampleViolations = [
      {
        violator_name: 'Juan Dela Cruz',
        violator_phone: '09171234567',
        vehicle_plate: 'ABC123',
        vehicle_model: 'Toyota Vios',
        vehicle_color: 'White',
        violation_type: 'Speeding',
        location: 'EDSA Guadalupe',
        fine_amount: 1000.00,
        status: 'paid'
      },
      {
        violator_name: 'Maria Santos',
        violator_phone: '09181234567',
        vehicle_plate: 'XYZ789',
        vehicle_model: 'Honda Civic',
        vehicle_color: 'Black',
        violation_type: 'Illegal Parking',
        location: 'Makati CBD',
        fine_amount: 500.00,
        status: 'pending'
      },
      {
        violator_name: 'Pedro Reyes',
        violator_phone: '09191234567',
        vehicle_plate: 'DEF456',
        vehicle_model: 'Mitsubishi Montero',
        vehicle_color: 'Blue',
        violation_type: 'No Helmet',
        location: 'C5 Road',
        fine_amount: 300.00,
        status: 'paid'
      },
      {
        violator_name: 'Anna Garcia',
        violator_phone: '09201234567',
        vehicle_plate: 'GHI789',
        vehicle_model: 'Suzuki Swift',
        vehicle_color: 'Red',
        violation_type: 'Running Red Light',
        location: 'Quezon Avenue',
        fine_amount: 1500.00,
        status: 'pending'
      },
      {
        violator_name: 'Roberto Cruz',
        violator_phone: '09211234567',
        vehicle_plate: 'JKL012',
        vehicle_model: 'Nissan Sentra',
        vehicle_color: 'Silver',
        violation_type: 'Reckless Driving',
        location: 'Commonwealth Avenue',
        fine_amount: 2000.00,
        status: 'paid'
      }
    ];
    
    let createdViolations = 0;
    
    for (const violation of sampleViolations) {
      // Generate violation number with Philippine format
      const violationNumber = generateViolationNumber(randomDate);
      
      // Random enforcer
      const randomEnforcer = enforcers[Math.floor(Math.random() * enforcers.length)];
      
      // Random date within last 30 days
      const randomDate = new Date();
      randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 30));
      
      // Due date (30 days from violation date)
      const dueDate = new Date(randomDate);
      dueDate.setDate(dueDate.getDate() + 30);
      
      // Insert violation
      await query(`
        INSERT INTO violations (
          violation_number, enforcer_id, violator_name, violator_phone,
          vehicle_plate, vehicle_model, vehicle_color, violation_type,
          location, fine_amount, status, created_at, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        violationNumber,
        randomEnforcer.id,
        violation.violator_name,
        violation.violator_phone,
        violation.vehicle_plate,
        violation.vehicle_model,
        violation.vehicle_color,
        violation.violation_type,
        violation.location,
        violation.fine_amount,
        violation.status,
        randomDate,
        dueDate
      ]);
      
      createdViolations++;
      console.log(`Created violation: ${violationNumber} by ${randomEnforcer.full_name}`);
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully created ${createdViolations} sample violations`,
      data: {
        created_violations: createdViolations,
        enforcers_used: enforcers.map(e => ({ id: e.id, name: e.full_name }))
      }
    });
    
  } catch (error) {
    console.error('Create sample data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sample data: ' + error.message
    });
  }
});

// @desc    Generate violation report
// @route   GET /api/reports/violations
// @access  Private (Admin only)
router.get('/violations', async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      enforcer_id, 
      status, 
      violation_type,
      format = 'json'
    } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (start_date) {
      whereClause += ' AND DATE(v.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(v.created_at) <= ?';
      params.push(end_date);
    }

    if (enforcer_id) {
      whereClause += ' AND v.enforcer_id = ?';
      params.push(enforcer_id);
    }

    if (status) {
      whereClause += ' AND v.status = ?';
      params.push(status);
    }

    if (violation_type) {
      whereClause += ' AND v.violation_type = ?';
      params.push(violation_type);
    }

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
    `, params);

    // Calculate summary statistics
    const totalViolations = violations.length;
    const totalFines = violations.reduce((sum, v) => sum + parseFloat(v.fine_amount), 0);
    const paidFines = violations
      .filter(v => v.status === 'paid')
      .reduce((sum, v) => sum + parseFloat(v.fine_amount), 0);
    const pendingFines = violations
      .filter(v => v.status === 'pending')
      .reduce((sum, v) => sum + parseFloat(v.fine_amount), 0);

    const report = {
      generated_at: new Date().toISOString(),
      filters: {
        start_date,
        end_date,
        enforcer_id,
        status,
        violation_type
      },
      summary: {
        total_violations: totalViolations,
        total_fines: totalFines,
        paid_fines: paidFines,
        pending_fines: pendingFines,
        collection_rate: totalFines > 0 ? (paidFines / totalFines * 100).toFixed(2) : 0
      },
      violations
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Violation Number',
        'Violator Name',
        'Vehicle Plate',
        'Violation Type',
        'Fine Amount',
        'Status',
        'Location',
        'Enforcer',
        'Date Created'
      ];

      const csvData = violations.map(v => [
        v.violation_number,
        v.violator_name,
        v.vehicle_plate || '',
        v.violation_type,
        v.fine_amount,
        v.status,
        v.location,
        v.enforcer_name,
        moment(v.created_at).format('YYYY-MM-DD HH:mm:ss')
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="violations_report_${moment().format('YYYY-MM-DD')}.csv"`);
      return res.send(csvContent);
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Generate violation report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Generate enforcer performance report
// @route   GET /api/reports/enforcers
// @access  Private (Admin only)
router.get('/enforcers', async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;
    console.log('Enforcers report request:', { start_date, end_date, format });

    // Build date filter for violations
    let dateFilter = '';
    let params = [];

    if (start_date || end_date) {
      let dateConditions = [];
      if (start_date) {
        dateConditions.push('DATE(v.created_at) >= ?');
        params.push(start_date);
      }
      if (end_date) {
        dateConditions.push('DATE(v.created_at) <= ?');
        params.push(end_date);
      }
      if (dateConditions.length > 0) {
        dateFilter = `AND (${dateConditions.join(' AND ')})`;
      }
    }

    console.log('Enforcers query dateFilter:', dateFilter);
    console.log('Enforcers query params:', params);

    // Get enforcer performance data with proper LEFT JOIN
    const queryString = `
      SELECT 
        u.id,
        u.full_name,
        u.badge_number,
        u.email,
        COALESCE(COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END), 0) as total_violations,
        COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN v.fine_amount ELSE 0 END), 0) as total_fines,
        COALESCE(SUM(CASE WHEN v.status = 'paid' THEN v.fine_amount ELSE 0 END), 0) as collected_fines,
        COALESCE(SUM(CASE WHEN v.status = 'pending' THEN v.fine_amount ELSE 0 END), 0) as pending_fines,
        COALESCE(COUNT(CASE WHEN v.status = 'paid' THEN 1 END), 0) as paid_violations,
        COALESCE(COUNT(CASE WHEN v.status = 'pending' THEN 1 END), 0) as pending_violations,
        COALESCE(COUNT(CASE WHEN v.id IS NOT NULL AND DATE(v.created_at) = CURDATE() THEN 1 END), 0) as today_violations,
        COALESCE(COUNT(CASE WHEN v.id IS NOT NULL AND MONTH(v.created_at) = MONTH(CURDATE()) AND YEAR(v.created_at) = YEAR(CURDATE()) THEN 1 END), 0) as month_violations
      FROM users u
      LEFT JOIN violations v ON u.id = v.enforcer_id ${dateFilter}
      WHERE u.role = 'enforcer' AND u.is_active = TRUE
      GROUP BY u.id, u.full_name, u.badge_number, u.email
      ORDER BY total_violations DESC
    `;

    console.log('Enforcers query string:', queryString);
    
    let enforcerStats;
    try {
      enforcerStats = await query(queryString, params);
      console.log('Enforcers query result:', enforcerStats);
    } catch (queryError) {
      console.error('Query failed, trying fallback query:', queryError);
      
      // Fallback: Get all enforcers and separately count their violations
      const fallbackQuery = `
        SELECT 
          u.id,
          u.full_name,
          u.badge_number,
          u.email
        FROM users u
        WHERE u.role = 'enforcer' AND u.is_active = TRUE
        ORDER BY u.full_name
      `;
      
      const enforcers = await query(fallbackQuery);
      console.log('Fallback enforcers result:', enforcers);
      
      // For each enforcer, get their violation stats
      enforcerStats = [];
      for (const enforcer of enforcers) {
        let violationQuery = 'SELECT COUNT(*) as total_violations, COALESCE(SUM(fine_amount), 0) as total_fines, COALESCE(SUM(CASE WHEN status = "paid" THEN fine_amount ELSE 0 END), 0) as collected_fines, COALESCE(SUM(CASE WHEN status = "pending" THEN fine_amount ELSE 0 END), 0) as pending_fines, COALESCE(COUNT(CASE WHEN status = "paid" THEN 1 END), 0) as paid_violations, COALESCE(COUNT(CASE WHEN status = "pending" THEN 1 END), 0) as pending_violations, COALESCE(COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END), 0) as today_violations, COALESCE(COUNT(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 END), 0) as month_violations FROM violations WHERE enforcer_id = ?';
        let violationParams = [enforcer.id];
        
        if (start_date) {
          violationQuery += ' AND DATE(created_at) >= ?';
          violationParams.push(start_date);
        }
        if (end_date) {
          violationQuery += ' AND DATE(created_at) <= ?';
          violationParams.push(end_date);
        }
        
        const [stats] = await query(violationQuery, violationParams);
        
        enforcerStats.push({
          ...enforcer,
          total_violations: stats.total_violations || 0,
          total_fines: stats.total_fines || 0,
          collected_fines: stats.collected_fines || 0,
          pending_fines: stats.pending_fines || 0,
          paid_violations: stats.paid_violations || 0,
          pending_violations: stats.pending_violations || 0,
          today_violations: stats.today_violations || 0,
          month_violations: stats.month_violations || 0
        });
      }
      
      console.log('Fallback final result:', enforcerStats);
    }

    // Calculate performance metrics
    const enrichedStats = enforcerStats.map(enforcer => {
      const collectionRate = enforcer.total_fines > 0 
        ? (enforcer.collected_fines / enforcer.total_fines * 100).toFixed(2) 
        : 0;
      
      const avgFineAmount = enforcer.total_violations > 0 
        ? (enforcer.total_fines / enforcer.total_violations).toFixed(2) 
        : 0;

      return {
        ...enforcer,
        collection_rate: parseFloat(collectionRate),
        avg_fine_amount: parseFloat(avgFineAmount),
        total_fines: parseFloat(enforcer.total_fines),
        collected_fines: parseFloat(enforcer.collected_fines),
        pending_fines: parseFloat(enforcer.pending_fines)
      };
    });

    console.log('Enriched enforcer stats:', enrichedStats);

    // Handle case where no enforcers found
    if (enrichedStats.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          generated_at: new Date().toISOString(),
          filters: { start_date, end_date },
          summary: {
            total_enforcers: 0,
            total_violations: 0,
            total_fines: 0,
            total_collected: 0,
            avg_collection_rate: 0
          },
          enforcers: [],
          message: 'No enforcers found or no violations in the selected date range'
        }
      });
    }

    const report = {
      generated_at: new Date().toISOString(),
      filters: { start_date, end_date },
      summary: {
        total_enforcers: enrichedStats.length,
        total_violations: enrichedStats.reduce((sum, e) => sum + e.total_violations, 0),
        total_fines: enrichedStats.reduce((sum, e) => sum + e.total_fines, 0),
        total_collected: enrichedStats.reduce((sum, e) => sum + e.collected_fines, 0),
        avg_collection_rate: enrichedStats.length > 0 
          ? (enrichedStats.reduce((sum, e) => sum + e.collection_rate, 0) / enrichedStats.length).toFixed(2)
          : 0
      },
      enforcers: enrichedStats
    };

    console.log('Final enforcers report:', report);

    if (format === 'csv') {
      const csvHeaders = [
        'Enforcer Name',
        'Badge Number',
        'Email',
        'Total Violations',
        'Total Fines',
        'Collected Fines',
        'Pending Fines',
        'Collection Rate (%)',
        'Average Fine Amount',
        'Today Violations',
        'Month Violations'
      ];

      const csvData = enrichedStats.map(e => [
        e.full_name,
        e.badge_number,
        e.email,
        e.total_violations,
        e.total_fines,
        e.collected_fines,
        e.pending_fines,
        e.collection_rate,
        e.avg_fine_amount,
        e.today_violations,
        e.month_violations
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="enforcer_performance_${moment().format('YYYY-MM-DD')}.csv"`);
      return res.send(csvContent);
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Generate enforcer report error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
});

// @desc    Generate daily summary report
// @route   GET /api/reports/daily-summary
// @access  Private (Admin only)
router.get('/daily-summary', async (req, res) => {
  try {
    const { date = moment().format('YYYY-MM-DD') } = req.query;
    console.log('Daily summary report request for date:', date);

    // Validate date format
    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Please use YYYY-MM-DD format.'
      });
    }

    // Check if date is not in the future
    if (moment(date).isAfter(moment(), 'day')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot generate report for future dates.'
      });
    }

    // Get daily violations with proper error handling
    let dailyViolations;
    try {
      dailyViolations = await query(`
        SELECT 
          v.*,
          u.full_name as enforcer_name,
          u.badge_number as enforcer_badge
        FROM violations v
        LEFT JOIN users u ON v.enforcer_id = u.id
        WHERE DATE(v.created_at) = ?
        ORDER BY v.created_at DESC
      `, [date]);
      console.log(`Found ${dailyViolations.length} violations for ${date}`);
      
      // Log first few violations for debugging
      if (dailyViolations.length > 0) {
        console.log('Sample violations:', dailyViolations.slice(0, 3).map(v => ({
          id: v.id,
          violation_number: v.violation_number,
          enforcer_id: v.enforcer_id,
          violator_name: v.violator_name,
          fine_amount: v.fine_amount,
          status: v.status,
          created_at: v.created_at
        })));
      }
    } catch (violationsError) {
      console.error('Error fetching daily violations:', violationsError);
      throw new Error('Failed to fetch violations data');
    }

    // Get violations by type for the day
    let violationsByType;
    try {
      violationsByType = await query(`
        SELECT 
          violation_type,
          COUNT(*) as count,
          SUM(fine_amount) as total_fines,
          ROUND(AVG(fine_amount), 2) as avg_fine
        FROM violations 
        WHERE DATE(created_at) = ?
        GROUP BY violation_type
        ORDER BY count DESC
      `, [date]);
      
      // Format the results
      violationsByType = violationsByType.map(item => ({
        violation_type: item.violation_type,
        count: parseInt(item.count),
        total_fines: parseFloat(item.total_fines || 0),
        avg_fine: parseFloat(item.avg_fine || 0)
      }));
      
      console.log(`Found ${violationsByType.length} violation types for ${date}`);
    } catch (typeError) {
      console.error('Error fetching violations by type:', typeError);
      violationsByType = [];
    }

    // Get violations by enforcer for the day with improved query
    let violationsByEnforcer;
    try {
      violationsByEnforcer = await query(`
        SELECT 
          u.id,
          u.full_name,
          u.badge_number,
          u.email,
          COALESCE(COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END), 0) as violations_count,
          COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN v.fine_amount ELSE 0 END), 0) as total_fines,
          COALESCE(COUNT(CASE WHEN v.status = 'paid' THEN 1 END), 0) as paid_violations,
          COALESCE(COUNT(CASE WHEN v.status = 'pending' THEN 1 END), 0) as pending_violations
        FROM users u
        LEFT JOIN violations v ON u.id = v.enforcer_id AND DATE(v.created_at) = ?
        WHERE u.role = 'enforcer' AND u.is_active = TRUE
        GROUP BY u.id, u.full_name, u.badge_number, u.email
        ORDER BY violations_count DESC, u.full_name ASC
      `, [date]);
      
      // Format the results
      violationsByEnforcer = violationsByEnforcer.map(item => ({
        id: item.id,
        full_name: item.full_name,
        badge_number: item.badge_number,
        email: item.email,
        violations_count: parseInt(item.violations_count),
        total_fines: parseFloat(item.total_fines || 0),
        paid_violations: parseInt(item.paid_violations || 0),
        pending_violations: parseInt(item.pending_violations || 0)
      }));
      
      console.log(`Found ${violationsByEnforcer.length} enforcers for ${date}`);
    } catch (enforcerError) {
      console.error('Error fetching violations by enforcer:', enforcerError);
      violationsByEnforcer = [];
    }

    // Get status breakdown
    let statusBreakdown;
    try {
      statusBreakdown = await query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(fine_amount) as total_fines
        FROM violations 
        WHERE DATE(created_at) = ?
        GROUP BY status
        ORDER BY count DESC
      `, [date]);
      
      // Format the results
      statusBreakdown = statusBreakdown.map(item => ({
        status: item.status,
        count: parseInt(item.count),
        total_fines: parseFloat(item.total_fines || 0)
      }));
    } catch (statusError) {
      console.error('Error fetching status breakdown:', statusError);
      statusBreakdown = [];
    }

    // Calculate comprehensive summary metrics
    const totalViolations = dailyViolations.length;
    const totalFines = dailyViolations.reduce((sum, v) => sum + parseFloat(v.fine_amount || 0), 0);
    const activeEnforcers = violationsByEnforcer.filter(e => e.violations_count > 0).length;
    const totalEnforcers = violationsByEnforcer.length;
    
    // Calculate additional metrics
    const paidViolations = dailyViolations.filter(v => v.status === 'paid').length;
    const pendingViolations = dailyViolations.filter(v => v.status === 'pending').length;
    const paidFines = dailyViolations
      .filter(v => v.status === 'paid')
      .reduce((sum, v) => sum + parseFloat(v.fine_amount || 0), 0);
    const pendingFines = dailyViolations
      .filter(v => v.status === 'pending')
      .reduce((sum, v) => sum + parseFloat(v.fine_amount || 0), 0);
    
    const avgFineAmount = totalViolations > 0 ? totalFines / totalViolations : 0;
    const avgViolationsPerEnforcer = activeEnforcers > 0 ? totalViolations / activeEnforcers : 0;
    const collectionRate = totalFines > 0 ? (paidFines / totalFines * 100) : 0;
    const enforcerUtilizationRate = totalEnforcers > 0 ? (activeEnforcers / totalEnforcers * 100) : 0;

    // Format recent violations for better display
    const recentViolations = dailyViolations.slice(0, 10).map(violation => ({
      ...violation,
      fine_amount: parseFloat(violation.fine_amount || 0),
      created_at: violation.created_at,
      formatted_time: moment(violation.created_at).format('HH:mm:ss'),
      formatted_amount: `₱${parseFloat(violation.fine_amount || 0).toLocaleString()}`
    }));

    const report = {
      date,
      day_name: moment(date).format('dddd'),
      formatted_date: moment(date).format('MMMM DD, YYYY'),
      generated_at: new Date().toISOString(),
      summary: {
        total_violations: totalViolations,
        total_fines: parseFloat(totalFines.toFixed(2)),
        active_enforcers: activeEnforcers,
        total_enforcers: totalEnforcers,
        avg_violations_per_enforcer: parseFloat(avgViolationsPerEnforcer.toFixed(2)),
        paid_violations: paidViolations,
        pending_violations: pendingViolations,
        paid_fines: parseFloat(paidFines.toFixed(2)),
        pending_fines: parseFloat(pendingFines.toFixed(2)),
        avg_fine_amount: parseFloat(avgFineAmount.toFixed(2)),
        collection_rate: parseFloat(collectionRate.toFixed(2)),
        enforcer_utilization_rate: parseFloat(enforcerUtilizationRate.toFixed(2))
      },
      violations_by_type: violationsByType,
      violations_by_enforcer: violationsByEnforcer,
      violations_by_status: statusBreakdown,
      recent_violations: recentViolations,
      metadata: {
        query_execution_time: new Date().toISOString(),
        data_freshness: 'real-time',
        total_queries_executed: 4
      }
    };

    console.log('Daily summary report generated successfully:', {
      date,
      totalViolations,
      totalFines,
      activeEnforcers,
      violationTypes: violationsByType.length
    });

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Generate daily summary error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Server error while generating daily summary: ' + error.message
    });
  }
});

// @desc    Generate monthly report
// @route   GET /api/reports/monthly
// @access  Private (Admin only)
router.get('/monthly', async (req, res) => {
  try {
    const { year = moment().year(), month = moment().month() + 1 } = req.query;

    // Get monthly violations
    const monthlyViolations = await query(`
      SELECT 
        v.*,
        u.full_name as enforcer_name
      FROM violations v
      JOIN users u ON v.enforcer_id = u.id
      WHERE YEAR(v.created_at) = ? AND MONTH(v.created_at) = ?
      ORDER BY v.created_at DESC
    `, [year, month]);

    // Get daily breakdown
    const dailyBreakdown = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as violations_count,
        SUM(fine_amount) as daily_fines
      FROM violations 
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [year, month]);

    // Get violations by status
    const violationsByStatus = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(fine_amount) as total_fines
      FROM violations 
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY status
    `, [year, month]);

    // Calculate summary
    const totalViolations = monthlyViolations.length;
    const totalFines = monthlyViolations.reduce((sum, v) => sum + parseFloat(v.fine_amount), 0);
    const paidFines = monthlyViolations
      .filter(v => v.status === 'paid')
      .reduce((sum, v) => sum + parseFloat(v.fine_amount), 0);

    const report = {
      year: parseInt(year),
      month: parseInt(month),
      month_name: moment(`${year}-${month}-01`).format('MMMM YYYY'),
      generated_at: new Date().toISOString(),
      summary: {
        total_violations: totalViolations,
        total_fines: totalFines,
        paid_fines: paidFines,
        collection_rate: totalFines > 0 ? (paidFines / totalFines * 100).toFixed(2) : 0,
        avg_daily_violations: (totalViolations / moment(`${year}-${month}-01`).daysInMonth()).toFixed(2)
      },
      daily_breakdown: dailyBreakdown,
      violations_by_status: violationsByStatus,
      violations: monthlyViolations
    };

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Generate monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
