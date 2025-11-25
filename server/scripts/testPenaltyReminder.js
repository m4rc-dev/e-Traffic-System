const { sendPenaltyReminders } = require('./penaltyReminder');

// Run the penalty reminder function
async function runTest() {
  try {
    const result = await sendPenaltyReminders();
    console.log('Test completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();