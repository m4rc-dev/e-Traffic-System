const { getFirebaseService } = require('../config/database');
const { sendSMS } = require('../services/smsService');
const { connectDB } = require('../config/database');

/**
 * Send penalty reminder notifications for violations that are overdue
 * This script checks for violations that are past their due date and sends reminders
 */
async function sendPenaltyReminders() {
  try {
    console.log('🔍 Checking for overdue violations to send penalty reminders...');

    // Initialize database connection
    await connectDB();
    const firebaseService = getFirebaseService();

    // Get all unpaid violations that are past their due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get violations with 'issued' or 'pending' status
    // We fetch these specifically to avoid fetching thousands of 'paid' or 'cancelled' violations
    // This allows the limit: 1000 to apply only to active violations, significantly checking more relevant records
    const issuedViolations = await firebaseService.getViolations({ status: 'issued' }, { limit: 1000 });
    const pendingViolations = await firebaseService.getViolations({ status: 'pending' }, { limit: 1000 });

    // Combine and deduplicate (though IDs should be unique per query)
    const activeViolations = [...issuedViolations, ...pendingViolations];

    // Filter for overdue violations
    const overdueViolations = activeViolations.filter(violation => {
      // Skip test violations (violation_number starting with 'TEST-')
      if (violation.violation_number && violation.violation_number.startsWith('TEST-')) {
        return false;
      }

      // Safety check: Skip if already paid (though our query filtered this, double check)
      if (violation.status === 'paid') return false;

      // Skip if no due date
      if (!violation.due_date) return false;

      // Convert due_date to Date object (handle different formats)
      let dueDate;
      if (typeof violation.due_date === 'string') {
        dueDate = new Date(violation.due_date);
      } else if (violation.due_date.toDate) {
        dueDate = violation.due_date.toDate();
      } else {
        dueDate = new Date(violation.due_date);
      }

      // Reset time portion for comparison
      dueDate.setHours(0, 0, 0, 0);

      // Calculate days overdue
      // Example: Due Dec 1. Today Dec 2. Diff = 1 day (overdue).
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

      // LOGIC VERIFICATION:
      // Compliance period is 3 days. After 3 days, violation becomes overdue.
      // Day 1-3: Compliance period (within due date)
      // Day 4+: Overdue - Penalty Reminder Sent
      return daysOverdue > 0;
    });

    console.log(`📬 Found ${overdueViolations.length} overdue violations`);

    // Send reminders for each overdue violation
    let remindersSent = 0;
    for (const violation of overdueViolations) {
      try {
        // Skip test violations (safety check)
        if (violation.violation_number && violation.violation_number.startsWith('TEST-')) {
          console.log(`⏭️  Skipping test violation ${violation.violation_number}`);
          continue;
        }

        // Skip if no phone number
        if (!violation.violator_phone) continue;

        // Convert due_date to Date object
        let dueDate;
        if (typeof violation.due_date === 'string') {
          dueDate = new Date(violation.due_date);
        } else if (violation.due_date.toDate) {
          dueDate = violation.due_date.toDate();
        } else {
          dueDate = new Date(violation.due_date);
        }

        // Create short penalty reminder message for better delivery
        const message = `e-Traffic Reminder: Violation ${violation.violation_type}, Plate: ${violation.vehicle_plate}, Fine: PHP${violation.fine_amount}, Due: ${dueDate.toLocaleDateString()} (Compliance Period: 3 days). Please settle. Ref: ${violation.violation_number}`;

        // Send SMS
        console.log(`📱 Sending penalty reminder for violation ${violation.violation_number} to ${violation.violator_phone}`);
        const smsResult = await sendSMS(violation.violator_phone, message, violation.id);

        if (smsResult.success) {
          console.log(`✅ Penalty reminder sent successfully for violation ${violation.violation_number}`);
          remindersSent++;
        } else {
          console.log(`❌ Failed to send penalty reminder for violation ${violation.violation_number}: ${smsResult.message}`);
        }
      } catch (error) {
        console.error(`❌ Error processing violation ${violation.violation_number}:`, error.message);
      }
    }

    console.log(`🏁 Penalty reminder process completed. Sent ${remindersSent} reminders.`);
    return { success: true, remindersSent };
  } catch (error) {
    console.error('❌ Error in penalty reminder script:', error);
    return { success: false, error: error.message };
  }
}

// Run the script if called directly
if (require.main === module) {
  sendPenaltyReminders()
    .then(result => {
      console.log('Script execution result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { sendPenaltyReminders };