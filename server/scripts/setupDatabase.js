const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const setupDatabase = async () => {
  let connection;
  let dbConnection;
  
  try {
    // Connect to MySQL without specifying database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔗 Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'e_traffic_db'}`);
    console.log(`✅ Database '${process.env.DB_NAME || 'e_traffic_db'}' created/verified`);

    // Close the initial connection and create a new one with the database specified
    await connection.end();
    
    dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'e_traffic_db'
    });

    console.log(`✅ Connected to database '${process.env.DB_NAME || 'e_traffic_db'}'`);

    // Create users table
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'enforcer') NOT NULL DEFAULT 'enforcer',
        full_name VARCHAR(100) NOT NULL,
        badge_number VARCHAR(20) UNIQUE,
        phone_number VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        last_login DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create violations table
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS violations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        violation_number VARCHAR(50) UNIQUE NOT NULL,
        enforcer_id INT NOT NULL,
        violator_name VARCHAR(100) NOT NULL,
        violator_license VARCHAR(50),
        violator_phone VARCHAR(20),
        violator_address TEXT,
        vehicle_plate VARCHAR(20),
        vehicle_model VARCHAR(100),
        vehicle_color VARCHAR(50),
        violation_type VARCHAR(100) NOT NULL,
        violation_description TEXT,
        location VARCHAR(255) NOT NULL,
        fine_amount DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'issued', 'paid', 'disputed', 'cancelled') DEFAULT 'pending',
        notes TEXT,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date DATE,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (enforcer_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Violations table created');

    // Create sms_logs table
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        violation_id INT NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
        api_response JSON,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP NULL,
        FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ SMS logs table created');

    // Create audit_logs table
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50),
        record_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Audit logs table created');

    // Create system_settings table
    await dbConnection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ System settings table created');

    // Insert default admin user
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@etraffic.com';
    
    const [existingAdmin] = await dbConnection.execute(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );

    if (existingAdmin.length === 0) {
      await dbConnection.execute(`
        INSERT INTO users (username, email, password, role, full_name, badge_number, is_active)
        VALUES (?, ?, ?, 'admin', 'System Administrator', 'ADMIN001', TRUE)
      `, ['admin', adminEmail, adminPassword]);
      console.log('✅ Default admin user created');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // Insert default system settings
    const defaultSettings = [
      ['sms_enabled', 'true', 'Enable/disable SMS notifications'],
      ['fine_due_days', '30', 'Number of days before fine is due'],
      ['max_photos_per_violation', '5', 'Maximum number of photos per violation'],
      ['system_name', 'e-Traffic System', 'System display name'],
      ['contact_email', 'support@etraffic.com', 'System contact email']
    ];

    for (const [key, value, description] of defaultSettings) {
      await dbConnection.execute(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
      `, [key, value, description]);
    }
    console.log('✅ Default system settings created');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Default Admin Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log('\n⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
    if (dbConnection) {
      await dbConnection.end();
    }
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('✅ Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;
