/**
 * Test script for IPROG SMS API
 * Run with: node scripts/testSms.js <phone_number>
 * Example: node scripts/testSms.js 09171234567
 */

const axios = require('axios');

const testSMS = async () => {
    const phoneNumber = process.argv[2];

    if (!phoneNumber) {
        console.log('Usage: node scripts/testSms.js <phone_number>');
        console.log('Example: node scripts/testSms.js 09108171403');
        process.exit(1);
    }

    const apiToken = process.env.IPROGSMS_API_TOKEN || '1e285b5aa3b0e31fce7f7a40dc69a5789a1f43a1';
    const apiUrl = 'https://www.iprogsms.com/api/v1/sms_messages';

    const smsPayload = {
        api_token: apiToken,
        phone_number: phoneNumber,
        message: 'Test SMS from e-Traffic System - ' + new Date().toLocaleString(),
        sender_name: "Ka Prets"
    };

    console.log('='.repeat(50));
    console.log('IPROG SMS Test');
    console.log('='.repeat(50));
    console.log('Sending to:', phoneNumber);
    console.log('Sender Name:', smsPayload.sender_name);
    console.log('API URL:', apiUrl);
    console.log('='.repeat(50));

    try {
        const response = await axios.post(apiUrl, smsPayload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('\n✅ API Response:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.status === 200) {
            console.log('\n✅ SMS sent successfully!');
        } else {
            console.log('\n❌ SMS failed:', response.data.message);
        }
    } catch (error) {
        console.log('\n❌ Error sending SMS:');
        console.log('Error Message:', error.message);
        if (error.response) {
            console.log('Response Status:', error.response.status);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

testSMS();
