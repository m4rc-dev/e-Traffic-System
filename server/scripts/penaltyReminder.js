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
    
    // Get all violations that are not paid and have a due date before today
    const allViolations = await firebaseService.getViolations({}, { limit: 1000 });
    const overdueViolations = allViolations.filter(violation => {
      // Skip if already paid
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
      
      // Calculate days overdue (due date should be 7 days before today)
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      
      // Only send reminders for violations that are more than 7 days overdue
      return daysOverdue > 7;
    });
    
    console.log(`📬 Found ${overdueViolations.length} overdue violations`);
    
    // Send reminders for each overdue violation
    let remindersSent = 0;
    for (const violation of overdueViolations) {
      try {
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
        
        // Create simplified penalty reminder message to avoid spam filters
        const message = `Traffic Violation Reminder\n\n` +
          `Violation: ${violation.violation_type}\n` +
          `Plate: ${violation.vehicle_plate}\n` +
          `Fine: ₱${violation.fine_amount}\n` +
          `Due: ${dueDate.toLocaleDateString()}\n\n` +
          `Please settle at city transport office to avoid penalties.\n` +
          `Ref: ${violation.violation_number}`;
        
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