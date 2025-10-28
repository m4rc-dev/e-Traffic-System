const { initializeFirebase } = require('../config/firebase');
const FirebaseService = require('../config/firebaseService');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const setupFirebaseDatabase = async () => {
  let firebaseService;
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    firebaseService = new FirebaseService();
    
    console.log('🔗 Connected to Firebase Firestore');

    // Create default admin user
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@etraffic.com';
    
    const existingAdmin = await firebaseService.findUserByEmail(adminEmail);

    if (!existingAdmin) {
      const adminUser = await firebaseService.createUser({
        username: 'admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        full_name: 'System Administrator',
        badge_number: 'ADMIN001',
        phone_number: '',
        is_active: true,
        last_login: null
      });
      console.log('✅ Default admin user created');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // Create default system settings
    const defaultSettings = [
      {
        setting_key: 'sms_enabled',
        setting_value: 'true',
        description: 'Enable/disable SMS notifications'
      },
      {
        setting_key: 'fine_due_days',
        setting_value: '30',
        description: 'Number of days before fine is due'
      },
      {
        setting_key: 'max_photos_per_violation',
        setting_value: '5',
        description: 'Maximum number of photos per violation'
      },
      {
        setting_key: 'system_name',
        setting_value: 'e-Traffic System',
        description: 'System display name'
      },
      {
        setting_key: 'contact_email',
        setting_value: 'support@etraffic.com',
        description: 'System contact email'
      }
    ];

    for (const setting of defaultSettings) {
      const existingSetting = await firebaseService.findSettingByKey(setting.setting_key);
      if (!existingSetting) {
        await firebaseService.createSetting(setting);
      }
    }
    console.log('✅ Default system settings created');

    console.log('\n🎉 Firebase database setup completed successfully!');
    console.log('\n📋 Default Admin Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log('\n⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Firebase database setup failed:', error);
    throw error;
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupFirebaseDatabase()
    .then(() => {
      console.log('✅ Firebase database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Firebase database setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupFirebaseDatabase;
