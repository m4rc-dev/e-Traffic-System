const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { getFirebaseService } = require('../config/database');

const router = express.Router();
router.use(protect, adminOnly);

router.get('/health', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();
    const userCount = await firebaseService.count('users');
    res.status(200).json({ success: true, data: { database: 'Firebase Firestore', status: 'Connected', userCount, timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error('Health report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate health report' });
  }
});

router.get('/violations', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();
    const { start_date, end_date } = req.query;
    let allViolations = await firebaseService.getViolations({}, { limit: 10000 });
    console.log('Total violations fetched:', allViolations.length);

    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      end.setHours(23, 59, 59, 999);

      allViolations = allViolations.filter(violation => {
        if (!violation.created_at) return false;

        // Handle Firestore timestamp conversion
        let violationDate;
        if (violation.created_at.toDate) {
          violationDate = violation.created_at.toDate();
        } else if (violation.created_at.seconds) {
          violationDate = new Date(violation.created_at.seconds * 1000);
        } else {
          violationDate = new Date(violation.created_at);
        }

        return violationDate >= start && violationDate <= end;
      });

      console.log('Filtered violations:', allViolations.length);
    }

    const summary = {
      total_violations: allViolations.length,
      total_fines: allViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      pending_fines: allViolations.filter(v => v.status === 'pending' || v.status === 'issued').reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      collection_rate: allViolations.length > 0 ? Math.round((allViolations.filter(v => v.status === 'paid').length / allViolations.length) * 100) : 0
    };

    // Fetch all users once to create a lookup map
    const users = await firebaseService.getUsers({}, { limit: 1000 });
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user.full_name || 'Unknown';
    });

    const violations = allViolations.map(violation => {
      let enforcer_name = 'Unknown';
      if (violation.enforcer_id && userMap[violation.enforcer_id]) {
        enforcer_name = userMap[violation.enforcer_id];
      }
      return { ...violation, enforcer_name };
    });

    res.status(200).json({ success: true, data: { summary, violations } });
  } catch (error) {
    console.error('Violation report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate violation report' });
  }
});

router.get('/enforcers', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();
    const { start_date, end_date } = req.query;
    const enforcers = await firebaseService.getUsers({ role: 'enforcer' }, { limit: 1000 });
    let allViolations = await firebaseService.getViolations({}, { limit: 10000 });

    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);
      end.setHours(23, 59, 59, 999);

      allViolations = allViolations.filter(violation => {
        if (!violation.created_at) return false;

        // Handle Firestore timestamp conversion
        let violationDate;
        if (violation.created_at.toDate) {
          violationDate = violation.created_at.toDate();
        } else if (violation.created_at.seconds) {
          violationDate = new Date(violation.created_at.seconds * 1000);
        } else {
          violationDate = new Date(violation.created_at);
        }

        return violationDate >= start && violationDate <= end;
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const enforcersWithStats = enforcers.map(enforcer => {
      const enforcerViolations = allViolations.filter(v => v.enforcer_id === enforcer.id);
      const total_violations = enforcerViolations.length;
      const total_fines = enforcerViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
      const collected_fines = enforcerViolations.filter(v => v.status === 'paid').reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0);
      const collection_rate = total_violations > 0 ? Math.round((enforcerViolations.filter(v => v.status === 'paid').length / total_violations) * 100) : 0;

      const todayViolations = enforcerViolations.filter(v => {
        if (!v.created_at) return false;

        // Handle Firestore timestamp conversion
        let violationDate;
        if (v.created_at.toDate) {
          violationDate = v.created_at.toDate();
        } else if (v.created_at.seconds) {
          violationDate = new Date(v.created_at.seconds * 1000);
        } else {
          violationDate = new Date(v.created_at);
        }

        return violationDate >= today && violationDate <= todayEnd;
      });

      const monthViolations = enforcerViolations.filter(v => {
        if (!v.created_at) return false;

        // Handle Firestore timestamp conversion
        let violationDate;
        if (v.created_at.toDate) {
          violationDate = v.created_at.toDate();
        } else if (v.created_at.seconds) {
          violationDate = new Date(v.created_at.seconds * 1000);
        } else {
          violationDate = new Date(v.created_at);
        }

        return violationDate >= monthStart && violationDate <= monthEnd;
      });

      return {
        id: String(enforcer.id || ''),
        full_name: String(enforcer.full_name || 'Unknown'),
        badge_number: String(enforcer.badge_number || ''),
        total_violations: Number(total_violations) || 0,
        total_fines: Number(total_fines) || 0,
        collected_fines: Number(collected_fines) || 0,
        collection_rate: Number(collection_rate) || 0,
        today_violations: Number(todayViolations.length) || 0,
        month_violations: Number(monthViolations.length) || 0
      };
    });

    const summary = {
      total_enforcers: Number(enforcers.length) || 0,
      active_enforcers: enforcers.filter(e => e.is_active !== false).length,
      total_violations: Number(allViolations.length) || 0,
      total_fines: Number(allViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0)) || 0,
      collected_fines: Number(allViolations.filter(v => v.status === 'paid').reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0)) || 0,
      avg_collection_rate: Number(enforcersWithStats.length > 0 ? Math.round(enforcersWithStats.reduce((sum, e) => sum + e.collection_rate, 0) / enforcersWithStats.length) : 0) || 0,
      // Alias for PDF export compatibility
      get collection_rate() { return this.avg_collection_rate; }
    };

    res.status(200).json({ success: true, data: { summary, enforcers: enforcersWithStats } });
  } catch (error) {
    console.error('Enforcers report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate enforcers report' });
  }
});

router.get('/daily-summary', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);

    // Get all active enforcers from the system
    const allEnforcers = await firebaseService.getUsers({ role: 'enforcer' }, { limit: 1000 });
    const activeEnforcersInSystem = allEnforcers.filter(e => e.is_active !== false).length;

    const allViolations = await firebaseService.getViolations({}, { limit: 10000 });
    console.log('Total violations fetched:', allViolations.length);

    const dayViolations = allViolations.filter(violation => {
      if (!violation.created_at) return false;

      // Handle Firestore timestamp conversion
      let violationDate;
      if (violation.created_at.toDate) {
        violationDate = violation.created_at.toDate();
      } else if (violation.created_at.seconds) {
        // Handle Firestore timestamp without .toDate() method
        violationDate = new Date(violation.created_at.seconds * 1000);
      } else {
        violationDate = new Date(violation.created_at);
      }

      return violationDate >= targetDate && violationDate <= targetDateEnd;
    });

    console.log('Day violations count:', dayViolations.length);

    const enforcersWhoWorked = new Set();
    dayViolations.forEach(v => { if (v.enforcer_id) enforcersWhoWorked.add(v.enforcer_id); });

    const summary = {
      total_violations: dayViolations.length,
      total_fines: dayViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      active_enforcers: activeEnforcersInSystem,
      enforcers_worked_today: enforcersWhoWorked.size,
      avg_violations_per_enforcer: enforcersWhoWorked.size > 0 ? Math.round(dayViolations.length / enforcersWhoWorked.size) : 0
    };

    const violationsByType = {};
    dayViolations.forEach(v => { const type = v.violation_type || 'Unknown'; violationsByType[type] = (violationsByType[type] || 0) + 1; });

    const violationsByEnforcer = {};
    for (const v of dayViolations) {
      if (v.enforcer_id) {
        const enforcer = await firebaseService.findById('users', v.enforcer_id);
        const name = enforcer ? enforcer.full_name : 'Unknown';
        if (!violationsByEnforcer[name]) violationsByEnforcer[name] = 0;
        violationsByEnforcer[name]++;
      }
    }

    const recentViolations = [];
    for (const violation of dayViolations.slice().reverse().slice(0, 10)) {
      let enforcer_name = 'Unknown';
      if (violation.enforcer_id) {
        const enforcer = await firebaseService.findById('users', violation.enforcer_id);
        if (enforcer) enforcer_name = enforcer.full_name || 'Unknown';
      }
      recentViolations.push({ ...violation, enforcer_name });
    }

    res.status(200).json({
      success: true,
      data: {
        summary,
        violations_by_type: Object.entries(violationsByType).map(([violation_type, count]) => ({ violation_type, count })),
        violations_by_enforcer: Object.entries(violationsByEnforcer).map(([full_name, violations_count]) => ({ full_name, violations_count })),
        recent_violations: recentViolations
      }
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate daily summary' });
  }
});

router.get('/monthly', async (req, res) => {
  try {
    const firebaseService = getFirebaseService();
    const { year, month } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const allViolations = await firebaseService.getViolations({}, { limit: 10000 });
    console.log('Monthly report: Total violations fetched:', allViolations.length);

    const monthViolations = allViolations.filter(violation => {
      if (!violation.created_at) return false;

      // Handle Firestore timestamp conversion
      let violationDate;
      if (violation.created_at.toDate) {
        violationDate = violation.created_at.toDate();
      } else if (violation.created_at.seconds) {
        violationDate = new Date(violation.created_at.seconds * 1000);
      } else {
        violationDate = new Date(violation.created_at);
      }

      return violationDate >= monthStart && violationDate <= monthEnd;
    });

    console.log('Monthly report: Filtered violations:', monthViolations.length);

    const summary = {
      total_violations: monthViolations.length,
      total_fines: monthViolations.reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      paid_fines: monthViolations.filter(v => v.status === 'paid').reduce((sum, v) => sum + (parseFloat(v.fine_amount) || 0), 0),
      collection_rate: monthViolations.length > 0 ? Math.round((monthViolations.filter(v => v.status === 'paid').length / monthViolations.length) * 100) : 0,
      avg_daily_violations: Math.round(monthViolations.length / monthEnd.getDate())
    };

    const violationsByStatus = {};
    monthViolations.forEach(v => { const status = v.status || 'pending'; violationsByStatus[status] = (violationsByStatus[status] || 0) + 1; });

    const dailyBreakdown = [];
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const dayStart = new Date(targetYear, targetMonth - 1, day);
      const dayEnd = new Date(targetYear, targetMonth - 1, day, 23, 59, 59, 999);
      const dayViolations = monthViolations.filter(v => {
        // Handle Firestore timestamp conversion
        let violationDate;
        if (v.created_at.toDate) {
          violationDate = v.created_at.toDate();
        } else if (v.created_at.seconds) {
          violationDate = new Date(v.created_at.seconds * 1000);
        } else {
          violationDate = new Date(v.created_at);
        }

        return violationDate >= dayStart && violationDate <= dayEnd;
      });
      dailyBreakdown.push({
        date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        violations_count: dayViolations.length
      });
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    res.status(200).json({
      success: true,
      data: {
        summary,
        month_name: monthNames[targetMonth - 1],
        violations_by_status: Object.entries(violationsByStatus).map(([status, count]) => ({ status, count })),
        daily_breakdown: dailyBreakdown
      }
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate monthly report' });
  }
});

module.exports = router;

