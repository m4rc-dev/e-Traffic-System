const mysql = require('mysql2/promise');
const { initializeFirebase } = require('../config/firebase');
const FirebaseService = require('../config/firebaseService');
require('dotenv').config();

/**
 * Data Migration Script: MySQL to Firebase
 * This script helps migrate existing MySQL data to Firebase Firestore
 */

class DataMigrator {
  constructor() {
    this.mysqlConnection = null;
    this.firebaseService = null;
  }

  async connectMySQL() {
    try {
      this.mysqlConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'e_traffic_db',
        port: process.env.DB_PORT || 3306
      });
      console.log('✅ Connected to MySQL database');
    } catch (error) {
      console.error('❌ MySQL connection failed:', error);
      throw error;
    }
  }

  async connectFirebase() {
    try {
      await initializeFirebase();
      this.firebaseService = new FirebaseService();
      console.log('✅ Connected to Firebase Firestore');
    } catch (error) {
      console.error('❌ Firebase connection failed:', error);
      throw error;
    }
  }

  async migrateUsers() {
    console.log('🔄 Migrating users...');
    try {
      const [users] = await this.mysqlConnection.execute('SELECT * FROM users');
      
      for (const user of users) {
        // Check if user already exists in Firebase
        const existingUser = await this.firebaseService.findUserByEmail(user.email);
        
        if (!existingUser) {
          await this.firebaseService.createUser({
            username: user.username,
            email: user.email,
            password: user.password, // Already hashed
            role: user.role,
            full_name: user.full_name,
            badge_number: user.badge_number,
            phone_number: user.phone_number,
            is_active: user.is_active,
            last_login: user.last_login,
            created_at: user.created_at,
            updated_at: user.updated_at
          });
          console.log(`✅ Migrated user: ${user.email}`);
        } else {
          console.log(`ℹ️ User already exists: ${user.email}`);
        }
      }
      
      console.log(`✅ Users migration completed: ${users.length} users processed`);
    } catch (error) {
      console.error('❌ Users migration failed:', error);
      throw error;
    }
  }

  async migrateViolations() {
    console.log('🔄 Migrating violations...');
    try {
      const [violations] = await this.mysqlConnection.execute('SELECT * FROM violations');
      
      for (const violation of violations) {
        // Check if violation already exists
        const existingViolation = await this.firebaseService.findViolationByNumber(violation.violation_number);
        
        if (!existingViolation) {
          await this.firebaseService.createViolation({
            violation_number: violation.violation_number,
            enforcer_id: violation.enforcer_id,
            violator_name: violation.violator_name,
            violator_license: violation.violator_license,
            violator_phone: violation.violator_phone,
            violator_address: violation.violator_address,
            vehicle_plate: violation.vehicle_plate,
            vehicle_model: violation.vehicle_model,
            vehicle_color: violation.vehicle_color,
            violation_type: violation.violation_type,
            violation_description: violation.violation_description,
            location: violation.location,
            fine_amount: violation.fine_amount,
            status: violation.status,
            notes: violation.notes,
            issued_at: violation.issued_at,
            due_date: violation.due_date,
            paid_at: violation.paid_at,
            created_at: violation.created_at,
            updated_at: violation.updated_at
          });
          console.log(`✅ Migrated violation: ${violation.violation_number}`);
        } else {
          console.log(`ℹ️ Violation already exists: ${violation.violation_number}`);
        }
      }
      
      console.log(`✅ Violations migration completed: ${violations.length} violations processed`);
    } catch (error) {
      console.error('❌ Violations migration failed:', error);
      throw error;
    }
  }

  async migrateSmsLogs() {
    console.log('🔄 Migrating SMS logs...');
    try {
      const [smsLogs] = await this.mysqlConnection.execute('SELECT * FROM sms_logs');
      
      for (const smsLog of smsLogs) {
        await this.firebaseService.createSmsLog({
          violation_id: smsLog.violation_id,
          phone_number: smsLog.phone_number,
          message: smsLog.message,
          status: smsLog.status,
          api_response: smsLog.api_response ? JSON.parse(smsLog.api_response) : null,
          sent_at: smsLog.sent_at,
          delivered_at: smsLog.delivered_at
        });
        console.log(`✅ Migrated SMS log: ${smsLog.id}`);
      }
      
      console.log(`✅ SMS logs migration completed: ${smsLogs.length} logs processed`);
    } catch (error) {
      console.error('❌ SMS logs migration failed:', error);
      throw error;
    }
  }

  async migrateAuditLogs() {
    console.log('🔄 Migrating audit logs...');
    try {
      const [auditLogs] = await this.mysqlConnection.execute('SELECT * FROM audit_logs');
      
      for (const auditLog of auditLogs) {
        await this.firebaseService.createAuditLog({
          user_id: auditLog.user_id,
          action: auditLog.action,
          table_name: auditLog.table_name,
          record_id: auditLog.record_id,
          old_values: auditLog.old_values ? JSON.parse(auditLog.old_values) : null,
          new_values: auditLog.new_values ? JSON.parse(auditLog.new_values) : null,
          ip_address: auditLog.ip_address,
          user_agent: auditLog.user_agent,
          created_at: auditLog.created_at
        });
        console.log(`✅ Migrated audit log: ${auditLog.id}`);
      }
      
      console.log(`✅ Audit logs migration completed: ${auditLogs.length} logs processed`);
    } catch (error) {
      console.error('❌ Audit logs migration failed:', error);
      throw error;
    }
  }

  async migrateSystemSettings() {
    console.log('🔄 Migrating system settings...');
    try {
      const [settings] = await this.mysqlConnection.execute('SELECT * FROM system_settings');
      
      for (const setting of settings) {
        // Check if setting already exists
        const existingSetting = await this.firebaseService.findSettingByKey(setting.setting_key);
        
        if (!existingSetting) {
          await this.firebaseService.createSetting({
            setting_key: setting.setting_key,
            setting_value: setting.setting_value,
            description: setting.description,
            updated_at: setting.updated_at
          });
          console.log(`✅ Migrated setting: ${setting.setting_key}`);
        } else {
          console.log(`ℹ️ Setting already exists: ${setting.setting_key}`);
        }
      }
      
      console.log(`✅ System settings migration completed: ${settings.length} settings processed`);
    } catch (error) {
      console.error('❌ System settings migration failed:', error);
      throw error;
    }
  }

  async migrateAll() {
    try {
      console.log('🚀 Starting data migration from MySQL to Firebase...\n');
      
      await this.connectMySQL();
      await this.connectFirebase();
      
      // Migrate in order (respecting foreign key dependencies)
      await this.migrateUsers();
      await this.migrateViolations();
      await this.migrateSmsLogs();
      await this.migrateAuditLogs();
      await this.migrateSystemSettings();
      
      console.log('\n🎉 Data migration completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Update your .env file to use Firebase configuration');
      console.log('2. Test the application with Firebase');
      console.log('3. Remove MySQL dependencies when ready');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      if (this.mysqlConnection) {
        await this.mysqlConnection.end();
        console.log('✅ MySQL connection closed');
      }
    }
  }

  async verifyMigration() {
    try {
      console.log('🔍 Verifying migration...');
      
      const userCount = await this.firebaseService.count('users');
      const violationCount = await this.firebaseService.count('violations');
      const smsLogCount = await this.firebaseService.count('sms_logs');
      const auditLogCount = await this.firebaseService.count('audit_logs');
      const settingCount = await this.firebaseService.count('system_settings');
      
      console.log('\n📊 Migration Summary:');
      console.log(`Users: ${userCount}`);
      console.log(`Violations: ${violationCount}`);
      console.log(`SMS Logs: ${smsLogCount}`);
      console.log(`Audit Logs: ${auditLogCount}`);
      console.log(`System Settings: ${settingCount}`);
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migrator = new DataMigrator();
  
  migrator.migrateAll()
    .then(() => migrator.verifyMigration())
    .then(() => {
      console.log('✅ Migration and verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = DataMigrator;
