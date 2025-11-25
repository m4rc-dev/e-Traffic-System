# E-Traffic System Database Visual Structure

## 🏗️ Database Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           E-TRAFFIC SYSTEM DATABASE                            │
│                              MySQL Database                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USERS TABLE   │    │ VIOLATIONS TABLE│    │  SMS_LOGS TABLE │
│                 │    │                 │    │                 │
│ • id (PK)       │    │ • id (PK)       │    │ • id (PK)       │
│ • username      │◄───┤ • enforcer_id   │◄───┤ • violation_id  │
│ • email         │    │ • violator_name │    │ • phone_number  │
│ • password      │    │ • vehicle_plate │    │ • message       │
│ • role          │    │ • violation_type│    │ • status        │
│ • full_name     │    │ • location      │    │ • api_response  │
│ • badge_number  │    │ • fine_amount   │    │ • sent_at       │
│ • phone_number  │    │ • status        │    │ • delivered_at  │
│ • is_active     │    │ • issued_at     │    │                 │
│ • last_login    │    │ • due_date      │    │                 │
│ • created_at    │    │ • paid_at       │    │                 │
│ • updated_at    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ AUDIT_LOGS TABLE│    │SYSTEM_SETTINGS  │
│                 │    │     TABLE       │
│ • id (PK)       │    │                 │
│ • user_id (FK)  │    │ • id (PK)       │
│ • action        │    │ • setting_key   │
│ • table_name    │    │ • setting_value │
│ • record_id     │    │ • description   │
│ • old_values    │    │ • updated_at    │
│ • new_values    │    │                 │
│ • ip_address    │    │                 │
│ • user_agent    │    │                 │
│ • created_at    │    │                 │
└─────────────────┘    └─────────────────┘
```

## 🔄 Data Flow Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   ADMIN     │    │  ENFORCER   │    │  VIOLATOR   │
│   USER      │    │   USER      │    │             │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │                  │                  │
      ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                USERS TABLE                          │
│  • Authentication & Authorization                   │
│  • Role-based Access Control                        │
│  • User Profile Management                          │
└─────────────────────────────────────────────────────┘
      │                  │
      │                  │
      ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              VIOLATIONS TABLE                       │
│  • Core Business Logic                              │
│  • Traffic Violation Records                        │
│  • Fine Management                                  │
│  • Evidence Storage                                 │
└─────────────────────────────────────────────────────┘
      │
      │
      ▼
┌─────────────────────────────────────────────────────┐
│               SMS_LOGS TABLE                        │
│  • Notification Tracking                            │
│  • Delivery Status                                  │
│  • Communication History                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              AUDIT_LOGS TABLE                       │
│  • Security & Compliance                            │
│  • Change Tracking                                  │
│  • User Activity Monitoring                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│            SYSTEM_SETTINGS TABLE                    │
│  • Configuration Management                         │
│  • Runtime Settings                                 │
│  • Feature Toggles                                  │
└─────────────────────────────────────────────────────┘
```

## 📊 Table Relationships

### Primary Relationships:
```
USERS (1) ──────────── (Many) VIOLATIONS
   │                           │
   │                           │
   │                           │
   │                           ▼
   │                    SMS_LOGS (Many)
   │
   ▼
AUDIT_LOGS (Many)

SYSTEM_SETTINGS (Independent)
```

### Relationship Details:
- **USERS → VIOLATIONS**: One enforcer can issue many violations
- **VIOLATIONS → SMS_LOGS**: One violation can have multiple SMS notifications
- **USERS → AUDIT_LOGS**: One user can have many audit entries
- **SYSTEM_SETTINGS**: Independent configuration table

## 🎯 Business Process Flow

```
1. USER LOGIN
   └── AUDIT_LOGS: LOGIN_SUCCESS/LOGIN_FAILED

2. ENFORCER CREATES VIOLATION
   ├── VIOLATIONS: New violation record
   ├── AUDIT_LOGS: CREATE_VIOLATION
   └── SMS_LOGS: Send notification

3. VIOLATION PAYMENT
   ├── VIOLATIONS: Update status to 'paid'
   ├── AUDIT_LOGS: UPDATE_VIOLATION
   └── SMS_LOGS: Send confirmation

4. ADMIN MANAGES USERS
   ├── USERS: Create/Update/Delete enforcers
   └── AUDIT_LOGS: User management actions

5. SYSTEM CONFIGURATION
   ├── SYSTEM_SETTINGS: Update configuration
   └── AUDIT_LOGS: Configuration changes
```

## 🔐 Security & Compliance

### Data Protection:
- **Passwords**: Hashed with bcrypt + salt
- **Sensitive Data**: Encrypted at rest
- **Access Control**: Role-based permissions
- **Audit Trail**: Complete action logging

### Compliance Features:
- **Data Retention**: Configurable retention policies
- **Audit Logging**: Complete change tracking
- **User Accountability**: All actions linked to users
- **Evidence Storage**: Secure photo/document storage

## 📈 Performance Considerations

### Indexing Strategy:
```
USERS:
├── PRIMARY KEY: id
├── UNIQUE: email, username, badge_number
└── INDEX: role, is_active

VIOLATIONS:
├── PRIMARY KEY: id
├── UNIQUE: violation_number
├── FOREIGN KEY: enforcer_id
└── INDEX: status, issued_at, location

SMS_LOGS:
├── PRIMARY KEY: id
├── FOREIGN KEY: violation_id
└── INDEX: status, sent_at

AUDIT_LOGS:
├── PRIMARY KEY: id
├── FOREIGN KEY: user_id
└── INDEX: created_at, action, table_name

SYSTEM_SETTINGS:
├── PRIMARY KEY: id
└── UNIQUE: setting_key
```

### Query Optimization:
- Foreign key indexes for fast joins
- Composite indexes on frequently queried fields
- Proper data types for efficient storage
- JSON fields for flexible data storage

This visual representation provides a clear understanding of the database structure, relationships, and data flow in the E-Traffic System.
