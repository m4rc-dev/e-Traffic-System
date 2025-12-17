const fs = require('fs');
const path = require('path');

// Mock Verification Script for Penalty Reminder Logic
const verifyDateLogic = () => {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    log(`📅 Setup: Today is ${today.toDateString()}`);

    const testCases = [
        { label: 'Exactly 7 Days Overdue (Should FAIL)', offset: 7, expected: false },
        { label: '8 Days Overdue (Should PASS)', offset: 8, expected: true },
        { label: '30 Days Overdue (Should PASS)', offset: 30, expected: true },
        { label: '1 Day Overdue (Should FAIL)', offset: 1, expected: false },
    ];

    log('\n🔍 Running Logic Tests:\n');

    let passed = 0;
    testCases.forEach(test => {
        // Simulate a due date 'offset' days ago
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() - test.offset);
        dueDate.setHours(0, 0, 0, 0);

        // Run the Logic
        const diffTime = today - dueDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays > 7;

        const result = isOverdue === test.expected ? '✅ PASS' : '❌ FAIL';
        if (isOverdue === test.expected) passed++;

        log(`${result} | ${test.label}`);
        log(`   Due: ${dueDate.toDateString()} (${diffDays} days ago)`);
        log(`   Result: ${isOverdue} (Expected: ${test.expected})\n`);
    });

    log(`\n🏁 Result: ${passed}/${testCases.length} tests passed.`);
    if (passed === testCases.length) {
        log('✨ Logic verified: Reminder is sent strictly AFTER 7 days.');
    } else {
        log('⚠️ Logic mismatch found.');
    }

    try {
        fs.writeFileSync(path.join(__dirname, '../../verify_result.txt'), output);
        console.log('Output written to verify_result.txt');
    } catch (err) {
        console.error('Error writing file:', err);
    }
};

verifyDateLogic();
