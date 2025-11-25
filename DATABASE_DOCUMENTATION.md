# E-Traffic System Database Documentation

## 📊 Entity Relationship Diagram (ERD)

To visualize the database structure, copy the code from `e-traffic-erd.dbml` and paste it into [dbdiagram.io](https://dbdiagram.io) to generate an interactive ERD.

## 🗄️ Database Tables Overview

The E-Traffic System uses a MySQL database with 5 core tables designed to handle traffic violation management, user authentication, SMS notifications, audit logging, and system configuration.

---

## 📋 Table Documentation

### 1. **users** Table
**Purpose**: Central user management for both administrators and traffic enforcers

#### Key Fields:
- `id` - Primary key (auto-increment)
- `username` - Unique username for login
- `email` - Unique email address
- `password` - Hashed password (bcrypt)
- `role` - User type: 'admin' or 'enforcer'
- `full_name` - Complete name of the user
- `badge_number` - Unique identifier for enforcers
- `phone_number` - Contact information
- `is_active` - Account status flag
- `last_login` - Timestamp of last successful login

#### Why This Table is Important:
• **Single Table Inheritance**: Uses one table for both admin and enforcer roles, simplifying user management
• **Authentication Hub**: Central point for all user authentication and authorization
• **Role-Based Access Control**: Enables different permissions based on user role
• **Audit Trail**: Links to audit logs for tracking user actions
• **Data Consistency**: Ensures all user-related data is in one place
• **Scalability**: Easy to add new roles or user types in the future

#### Business Rules:
- Each user must have a unique email and username
- Enforcers must have a badge number
- Passwords are hashed using bcrypt for security
- Inactive users cannot log in

---

### 2. **violations** Table
**Purpose**: Core business entity storing all traffic violation records

#### Key Fields:
- `id` - Primary key (auto-increment)
- `violation_number` - Unique violation identifier
- `enforcer_id` - Foreign key to users table (who issued the violation)
- `violator_name` - Name of the person who committed the violation
- `violator_license` - Driver's license number
- `violator_phone` - Contact number for notifications
- `violator_address` - Home address
- `vehicle_plate` - License plate number
- `vehicle_model` - Vehicle make and model
- `vehicle_color` - Vehicle color
- `violation_type` - Type of traffic violation
- `violation_description` - Detailed description
- `location` - Where the violation occurred
- `fine_amount` - Monetary penalty amount
- `status` - Current status: pending, issued, paid, disputed, cancelled
- `notes` - Additional notes
- `issued_at` - When the violation was issued
- `due_date` - Payment deadline
- `paid_at` - When payment was received

#### Why This Table is Important:
• **Core Business Logic**: Central to the entire traffic management system
• **Legal Compliance**: Maintains official records of traffic violations
• **Financial Tracking**: Manages fine collection and payment status
• **Status Workflow**: Tracks violation lifecycle from issue to resolution
• **Integration Point**: Links to SMS notifications and audit logs

#### Business Rules:
- Each violation must have a unique violation number
- Must be linked to an active enforcer
- Fine amounts must be positive numbers
- Due dates are calculated based on issue date

---

### 3. **sms_logs** Table
**Purpose**: Tracks SMS notifications sent to violators

#### Key Fields:
- `id` - Primary key (auto-increment)
- `violation_id` - Foreign key to violations table
- `phone_number` - Recipient's phone number
- `message` - SMS content sent
- `status` - Delivery status: pending, sent, failed, delivered
- `api_response` - JSON response from SMS service provider
- `sent_at` - When SMS was sent
- `delivered_at` - When SMS was delivered

#### Why This Table is Important:
• **Communication Tracking**: Monitors all SMS communications with violators
• **Delivery Confirmation**: Tracks whether messages were successfully delivered
• **Compliance**: Provides proof of notification for legal purposes
• **Error Handling**: Logs failed delivery attempts for retry logic
• **Audit Trail**: Records all communication attempts
• **Integration Monitoring**: Tracks SMS service provider performance
• **User Experience**: Ensures violators are properly notified

#### Business Rules:
- Each SMS must be linked to a violation
- Phone numbers must be in valid format
- Status transitions: pending → sent → delivered (or failed)
- API responses are stored for debugging

---

### 4. **audit_logs** Table
**Purpose**: Comprehensive audit trail for system security and compliance

#### Key Fields:
- `id` - Primary key (auto-increment)
- `user_id` - Foreign key to users table (who performed the action)
- `action` - Type of action performed (CREATE, UPDATE, DELETE, LOGIN, etc.)
- `table_name` - Which table was affected
- `record_id` - ID of the affected record
- `old_values` - JSON of values before change
- `new_values` - JSON of values after change
- `ip_address` - IP address of the user
- `user_agent` - Browser/client information
- `created_at` - When the action occurred

#### Why This Table is Important:
• **Security Compliance**: Meets regulatory requirements for audit trails
• **Forensic Analysis**: Enables investigation of suspicious activities
• **Change Tracking**: Records all data modifications for accountability
• **User Accountability**: Links actions to specific users
• **System Monitoring**: Helps identify system issues and patterns
• **Legal Protection**: Provides evidence for legal proceedings
• **Data Integrity**: Ensures all changes are tracked and reversible
• **Performance Analysis**: Tracks system usage patterns

#### Business Rules:
- All user actions must be logged
- Failed login attempts are also logged
- User ID can be null for system actions
- Old/new values are stored as JSON for flexibility
- IP addresses support both IPv4 and IPv6

---

### 5. **system_settings** Table
**Purpose**: Configuration management for system parameters

#### Key Fields:
- `id` - Primary key (auto-increment)
- `setting_key` - Unique identifier for the setting
- `setting_value` - The actual configuration value
- `description` - Human-readable description of the setting
- `updated_at` - When the setting was last modified

#### Why This Table is Important:
• **Configuration Management**: Centralizes all system settings
• **Runtime Configuration**: Allows changes without code deployment
• **Environment Flexibility**: Different settings for different environments
• **Feature Toggles**: Enables/disables features dynamically
• **Business Rules**: Stores configurable business parameters
• **Maintenance**: Easy to update system behavior
• **Scalability**: Supports growing configuration needs

#### Business Rules:
- Each setting must have a unique key
- Settings are updated through admin interface
- Changes are logged in audit trail
- Default values are provided for all settings

---

## 🔗 Table Relationships

### Primary Relationships:
1. **users → violations**: One-to-Many
   - One enforcer can issue many violations
   - Cascade delete: If enforcer is deleted, their violations are also deleted

2. **violations → sms_logs**: One-to-Many
   - One violation can have multiple SMS notifications
   - Cascade delete: If violation is deleted, SMS logs are also deleted

3. **users → audit_logs**: One-to-Many
   - One user can have many audit log entries
   - Set null: If user is deleted, audit logs remain but user_id becomes null

### Design Benefits:
• **Data Integrity**: Foreign key constraints ensure referential integrity
• **Cascade Operations**: Automatic cleanup when parent records are deleted
• **Query Efficiency**: Proper indexing for fast joins
• **Scalability**: Structure supports high-volume data growth

---

## 📈 Database Performance Considerations

### Indexing Strategy:
- Primary keys on all tables (auto-indexed)
- Unique indexes on email, username, violation_number, badge_number
- Foreign key indexes for join performance
- Composite indexes on frequently queried fields

### Data Types:
- **DECIMAL** for monetary values (precision maintained)
- **JSON** for flexible data storage (API responses)
- **ENUM** for controlled value sets (status fields)
- **TIMESTAMP** for automatic date/time management

### Security Features:
- Password hashing with bcrypt
- SQL injection prevention with parameterized queries
- Input validation and sanitization
- Role-based access control

---

## 🚀 Future Enhancements

### Potential Additions:
- **payment_logs** table for detailed payment tracking
- **violation_types** lookup table for standardized violation categories
- **locations** table for predefined violation locations
- **notifications** table for multi-channel communication
- **reports** table for cached report data
- **user_sessions** table for session management

### Scalability Considerations:
- Partitioning for large violation tables
- Read replicas for reporting queries
- Caching layer for frequently accessed data
- Archive strategy for old audit logs

---

## 📝 Usage Examples

### Common Queries:

```sql
-- Get all violations by an enforcer
SELECT v.*, u.full_name as enforcer_name 
FROM violations v 
JOIN users u ON v.enforcer_id = u.id 
WHERE u.id = ?;

-- Get violation statistics
SELECT 
  COUNT(*) as total_violations,
  SUM(fine_amount) as total_fines,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
FROM violations;

-- Get recent audit activity
SELECT al.*, u.full_name as user_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 10;
```

This database design provides a solid foundation for the E-Traffic System, ensuring data integrity, security, and scalability while meeting all business requirements.
