const { connectDB, getFirebaseService } = require('../config/database');

/**
 * Create a test violation with a past due date to test penalty reminders
 */
async function createTestOverdueViolation() {
  try {
    console.log('🔍 Creating test overdue violation...');
    
    // Initialize database connection
    await connectDB();
    const firebaseService = getFirebaseService();
    
    // Create a due date that is 10 days in the past
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 10);
    
    // Create test violation data
    const testViolation = {
      violation_number: 'TEST-OVERDUE-001',
      enforcer_id: null, // No specific enforcer for test
      violator_name: 'Test Violator',
      violator_phone: '09937747658', // Use a test phone number
      violator_license: 'TEST123456',
      violator_address: 'Test Address, Cebu City',
      vehicle_plate: 'TEST123',
      vehicle_model: 'Toyota Corolla',
      vehicle_color: 'White',
      violation_type: 'Overdue Test Violation',
      violation_description: 'This is a test violation created to test penalty reminder functionality',
      location: 'Test Location, Cebu City',
      fine_amount: 1500.00,
      status: 'issued', // Important: must not be 'paid'
      notes: 'Test violation for penalty reminder testing',
      due_date: dueDate,
      created_at: new Date()
    };
    
    // Create the violation in the database
    const violation = await firebaseService.createViolation(testViolation);
    
    console.log(`✅ Test overdue violation created successfully!`);
    console.log(`   Violation Number: ${violation.violation_number}`);
    console.log(`   Violator Name: ${violation.violator_name}`);
    
    // Handle different date formats from Firestore
    let dueDateDisplay;
    if (violation.due_date && typeof violation.due_date.toDate === 'function') {
      dueDateDisplay = violation.due_date.toDate().toLocaleDateString();
    } else if (violation.due_date instanceof Date) {
      dueDateDisplay = violation.due_date.toLocaleDateString();
    } else if (typeof violation.due_date === 'string') {
      dueDateDisplay = new Date(violation.due_date).toLocaleDateString();
    } else {
      dueDateDisplay = violation.due_date.toString();
    }
    
    console.log(`   Due Date: ${dueDateDisplay}`);
    console.log(`   Status: ${violation.status}`);
    console.log(`   Fine Amount: ₱${violation.fine_amount}`);
    
    // Calculate days overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dueDateObj;
    if (violation.due_date && typeof violation.due_date.toDate === 'function') {
      dueDateObj = violation.due_date.toDate();
    } else if (violation.due_date instanceof Date) {
      dueDateObj = violation.due_date;
    } else if (typeof violation.due_date === 'string') {
      dueDateObj = new Date(violation.due_date);
    } else {
      dueDateObj = new Date(violation.due_date);
    }
    
    dueDateObj.setHours(0, 0, 0, 0);
    const daysOverdue = Math.floor((today - dueDateObj) / (1000 * 60 * 60 * 24));
    
    console.log(`   Days Overdue: ${daysOverdue} days`);
    
    return { success: true, violation };
  } catch (error) {
    console.error('❌ Error creating test overdue violation:', error);
    return { success: false, error: error.message };
  }
}

// Run the script if called directly
if (require.main === module) {
  createTestOverdueViolation()
    .then(result => {
      console.log('Script execution result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestOverdueViolation };