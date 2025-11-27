# E-Traffic System Database Documentation

## 🎯 Overview
The E-Traffic System database is designed to manage traffic violations, user authentication, SMS notifications, audit logging, and system configuration. It uses MySQL as the primary database with a well-structured relational design.

## 📊 Database Schema

### Visual ERD
To view the interactive Entity Relationship Diagram:
1. Copy the contents of `e-traffic-erd.dbml`
2. Go to [dbdiagram.io](https://dbdiagram.io)
3. Paste the DBML code to generate the visual ERD

## 🗂️ Table Structure

### 1. **users** Table
**Purpose**: Central user management for administrators and traffic enforcers

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | INT |  | No | Primary key |
| username | VARCHAR | 50 | No | Login username |
| email | VARCHAR | 100 | No | Email address |
| password | VARCHAR | 255 | No | Hashed password |
| role | ENUM |  | No | 'admin' or 'enforcer' |
| full_name | VARCHAR | 100 | No | Complete name |
| badge_number | VARCHAR | 20 | Yes | Enforcer badge ID |
| phone_number | VARCHAR | 20 | Yes | Contact number |
| is_active | BOOLEAN |  | Yes | Account status |
| last_login | DATETIME |  | Yes | Last login timestamp |
| created_at | TIMESTAMP |  | No | Creation time |
| updated_at | TIMESTAMP |  | No | Last update time |

**Why Important:**
• **Single Table Design**: Manages both admin and enforcer roles efficiently
• **Authentication Hub**: Central point for all user authentication
• **Role-Based Access**: Enables different permissions per role
• **Audit Integration**: Links to audit logs for accountability
• **Data Consistency**: Ensures unified user management

---

### 2. **violations** Table
**Purpose**: Core business entity for traffic violation records

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | INT |  | No | Primary key |
| violation_number | VARCHAR | 50 | No | Unique violation ID |
| enforcer_id | INT |  | No | Issuing enforcer |
| violator_name | VARCHAR | 100 | No | Violator's name |
| violator_license | VARCHAR | 50 | Yes | Driver's license |
| violator_phone | VARCHAR | 20 | Yes | Contact number |
| violator_address | TEXT |  | Yes | Home address |
| vehicle_plate | VARCHAR | 20 | Yes | License plate |
| vehicle_model | VARCHAR | 100 | Yes | Vehicle make/model |
| vehicle_color | VARCHAR | 50 | Yes | Vehicle color |
| violation_type | VARCHAR | 100 | No | Type of violation |
| violation_description | TEXT |  | Yes | Detailed description |
| location | VARCHAR | 255 | No | Violation location |
| fine_amount | DECIMAL | 10,2 | No | Penalty amount |
| status | ENUM |  | Yes | Violation status |
| notes | TEXT |  | Yes | Additional notes |
| issued_at | TIMESTAMP |  | No | Issue time |
| due_date | DATE |  | Yes | Payment deadline |
| paid_at | TIMESTAMP |  | Yes | Payment time |
| created_at | TIMESTAMP |  | No | Creation time |
| updated_at | TIMESTAMP |  | No | Last update |

**Status Values:**
- `pending` - Newly created, not yet issued
- `issued` - Officially issued to violator
- `paid` - Fine has been paid
- `disputed` - Under dispute/review
- `cancelled` - Violation cancelled

**Why Important:**
• **Core Business Logic**: Central to traffic management system
• **Legal Compliance**: Maintains official violation records
• **Financial Tracking**: Manages fine collection
• **Evidence Management**: Stores photos and documentation
• **Geographic Data**: Enables location-based reporting
• **Status Workflow**: Tracks violation lifecycle

---

### 3. **sms_logs** Table
**Purpose**: Tracks SMS notifications sent to violators

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | INT |  | No | Primary key |
| violation_id | INT |  | No | Related violation |
| phone_number | VARCHAR | 20 | No | Recipient number |
| message | TEXT |  | No | SMS content |
| status | ENUM |  | Yes | Delivery status |
| api_response | JSON |  | Yes | SMS service response |
| sent_at | TIMESTAMP |  | No | Send time |
| delivered_at | TIMESTAMP |  | Yes | Delivery time |

**Status Values:**
- `pending` - Queued for sending
- `sent` - Successfully sent to provider
- `failed` - Failed to send
- `delivered` - Confirmed delivered

**Why Important:**
• **Communication Tracking**: Monitors all SMS communications
• **Delivery Confirmation**: Tracks message delivery status
• **Legal Compliance**: Provides proof of notification
• **Error Handling**: Logs failed attempts for retry
• **Integration Monitoring**: Tracks SMS service performance

---

### 4. **audit_logs** Table
**Purpose**: Comprehensive audit trail for security and compliance

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | INT |  | No | Primary key |
| user_id | INT |  | Yes | User who performed action |
| action | VARCHAR | 100 | No | Action type |
| table_name | VARCHAR | 50 | Yes | Affected table |
| record_id | INT |  | Yes | Affected record ID |
| old_values | JSON |  | Yes | Values before change |
| new_values | JSON |  | Yes | Values after change |
| ip_address | VARCHAR | 45 | Yes | User's IP address |
| user_agent | TEXT |  | Yes | Browser/client info |
| created_at | TIMESTAMP |  | No | Action time |

**Common Actions:**
- `LOGIN_SUCCESS` - Successful login
- `LOGIN_FAILED` - Failed login attempt
- `LOGOUT` - User logout
- `CREATE_ENFORCER` - New enforcer created
- `UPDATE_ENFORCER` - Enforcer updated
- `DELETE_ENFORCER` - Enforcer deleted
- `CREATE_VIOLATION` - New violation created
- `UPDATE_VIOLATION` - Violation updated
- `DELETE_VIOLATION` - Violation deleted

**Why Important:**
• **Security Compliance**: Meets regulatory audit requirements
• **Forensic Analysis**: Enables investigation of activities
• **Change Tracking**: Records all data modifications
• **User Accountability**: Links actions to specific users
• **System Monitoring**: Identifies usage patterns
• **Legal Protection**: Provides evidence for proceedings

---

### 5. **system_settings** Table
**Purpose**: Configuration management for system parameters

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | INT |  | No | Primary key |
| setting_key | VARCHAR | 100 | No | Setting identifier |
| setting_value | TEXT |  | Yes | Configuration value |
| description | TEXT |  | Yes | Human-readable description |
| updated_at | TIMESTAMP |  | No | Last update |

**Example Settings:**
- `sms_enabled` - Enable/disable SMS notifications
- `default_fine_amount` - Default fine for violations
- `violation_due_days` - Days until payment due
- `system_maintenance_mode` - Maintenance mode flag

**Why Important:**
• **Configuration Management**: Centralizes system settings
• **Runtime Configuration**: Changes without code deployment
• **Environment Flexibility**: Different settings per environment
• **Feature Toggles**: Dynamic feature enable/disable
• **Business Rules**: Configurable business parameters

---

## 🔗 Relationships

### Primary Relationships:
1. **users → violations** (1:Many)
   - One enforcer can issue many violations
   - CASCADE DELETE: Violations deleted when enforcer deleted

2. **violations → sms_logs** (1:Many)
   - One violation can have multiple SMS notifications
   - CASCADE DELETE: SMS logs deleted when violation deleted

3. **users → audit_logs** (1:Many)
   - One user can have many audit entries
   - SET NULL: Audit logs preserved when user deleted

### Relationship Benefits:
• **Data Integrity**: Foreign key constraints ensure consistency
• **Automatic Cleanup**: Cascade operations maintain data hygiene
• **Query Efficiency**: Proper indexing for fast joins
• **Scalability**: Structure supports high-volume growth

---

## 📈 Performance & Security

### Indexing Strategy:
- Primary keys (auto-indexed)
- Unique indexes on email, username, violation_number, badge_number
- Foreign key indexes for join performance
- Composite indexes on frequently queried fields

### Security Features:
- **Password Hashing**: bcrypt with salt rounds
- **SQL Injection Prevention**: Parameterized queries
- **Input Validation**: Server-side validation
- **Role-Based Access**: Different permissions per role
- **Audit Logging**: Complete action tracking

### Data Types:
- **DECIMAL**: Monetary values (precision maintained)
- **JSON**: Flexible data storage (photos, responses)
- **ENUM**: Controlled value sets (status fields)
- **TIMESTAMP**: Automatic date/time management

---

## 🚀 Usage Examples

### Common Queries:

```sql
-- Get violations by enforcer
SELECT v.*, u.full_name as enforcer_name 
FROM violations v 
JOIN users u ON v.enforcer_id = u.id 
WHERE u.id = ?;

-- Violation statistics
SELECT 
  COUNT(*) as total_violations,
  SUM(fine_amount) as total_fines,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
FROM violations;

-- Recent audit activity
SELECT al.*, u.full_name as user_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 10;

-- SMS delivery status
SELECT 
  COUNT(*) as total_sms,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM sms_logs;
```

---

## 🔧 Database Setup

### Initial Setup:
```bash
# Run the database setup script
cd server
node scripts/setupDatabase.js
```

### Environment Variables:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=e_traffic_db
DB_PORT=3306
ADMIN_EMAIL=admin@etraffic.com
ADMIN_PASSWORD=admin123
```

---

## 📋 Maintenance

### Regular Tasks:
- Monitor audit log growth
- Archive old violation records
- Update system settings as needed
- Review failed SMS logs
- Backup database regularly

### Performance Monitoring:
- Query execution times
- Index usage statistics
- Connection pool status
- Disk space usage

This database design provides a robust foundation for the E-Traffic System, ensuring data integrity, security, and scalability while meeting all business requirements.
