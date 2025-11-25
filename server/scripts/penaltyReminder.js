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
      
      // Set time to start of day for comparison
      dueDate.setHours(0, 0, 0, 0);
      
      // Check if due date is before today (overdue)
      return dueDate < today;
    });
    
    console.log(`📊 Found ${overdueViolations.length} overdue violations`);
    
    let remindersSent = 0;
    
    // Send reminders for each overdue violation
    for (const violation of overdueViolations) {
      try {
        // Skip if no phone number
        if (!violation.violator_phone) {
          console.log(`⏭️ Skipping violation ${violation.violation_number} - no phone number`);
          continue;
        }
        
        // Calculate days overdue
        let dueDate;
        if (typeof violation.due_date === 'string') {
          dueDate = new Date(violation.due_date);
        } else if (violation.due_date.toDate) {
          dueDate = violation.due_date.toDate();
        } else {
          dueDate = new Date(violation.due_date);
        }
        
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        // Create reminder message using the provided template
        // We need to be careful about message length to avoid spam filters
        const message = `Good day, Ma'am/Sir.\n\n` +
          `This is an official reminder from e-Traffic.\n\n` +
          `Our records show that the following traffic violation has exceeded the allowed 7-day payment period:\n\n` +
          `Violation Details:\n\n` +
          `Violator Name: ${violation.violator_name}\n` +
          `Plate Number: ${violation.vehicle_plate}\n` +
          `Violation Type: ${violation.violation_type}\n` +
          `Fine Amount: ₱${violation.fine_amount}\n` +
          `Location: ${violation.location}\n` +
          `Date of Violation: ${dueDate.toLocaleDateString()}\n\n` +
          `Please settle your penalty at the Cebu City Transportation Office to avoid further penalties.\n\n` +
          `Thank you for your cooperation.`;
        
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