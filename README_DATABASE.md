# E-Traffic System Database Documentation

## 🎯 Overview
The E-Traffic System uses **Google Cloud Firestore** (NoSQL) as its primary database. It manages traffic violations, user authentication, SMS notifications, logging, and system configuration through flexible document-based collections.

## 📊 Database Schema

### Visual Representation
Since Firestore is NoSQL, the schema is logical rather than enforced by the engine. The structure below represents the data model enforced by the application code.

## 🗂️ Collection Structure

### 1. **users** Collection
**Purpose**: Central user management for administrators and traffic enforcers.

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | String | N/A | No | Auto-generated Document ID |
| username | String | 50 | No | Login username |
| email | String | 100 | No | Email address |
| password | String | 255 | No | Hashed password |
| role | String | N/A | No | 'admin' or 'enforcer' |
| full_name | String | 100 | No | Complete name |
| badge_number | String | 20 | Yes | Enforcer badge ID (e.g., "BADGE-1234") |
| phone_number | String | 20 | Yes | Contact number |
| is_active | Boolean | N/A | No | Account status |
| last_login | Timestamp | N/A | Yes | Last login timestamp |
| created_at | Timestamp | N/A | No | Creation time |
| updated_at | Timestamp | N/A | No | Last update time |

**Key Features:**
• **Role-Based Access**: Distinguishes between 'admin' and 'enforcer'.
• **Authentication**: Used by JWT-based auth system.

---

### 2. **violations** Collection
**Purpose**: Core business entity for traffic violation records.

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | String | N/A | No | Auto-generated Document ID |
| violation_number | String | 50 | No | Unique human-readable ID |
| enforcer_id | String | N/A | No | Reference to `users` document ID |
| violator_name | String | 100 | No | Name of the violator |
| violator_license | String | 50 | Yes | Driver's license number |
| violator_phone | String | 20 | Yes | Contact number for SMS |
| violator_address | String | 255 | Yes | Home address |
| vehicle_plate | String | 20 | Yes | License plate number |
| vehicle_model | String | 100 | Yes | Vehicle make/model |
| vehicle_color | String | 50 | Yes | Vehicle color |
| violation_type | String | 100 | No | Type/Name of violation |
| violation_description | String | N/A | Yes | Detailed description |
| location | String | 255 | No | Violation location |
| fine_amount | Number | N/A | No | Penalty amount (Float) |
| status | String | N/A | No | 'pending', 'issued', 'paid', 'disputed', 'cancelled' |
| notes | String | N/A | Yes | Additional notes |
| is_repeat_offender | Boolean | N/A | No | **[NEW]** Flag if license/plate has prior history |
| previous_violations_count| Number | N/A | No | **[NEW]** Count of prior violations at creation |
| captured_at | Timestamp | N/A | No | **[NEW]** Actual time of violation (from IoT/Camera) |
| due_date | Timestamp | N/A | Yes | Payment deadline (usually +30 days) |
| paid_at | Timestamp | N/A | Yes | Payment completion time |
| created_at | Timestamp | N/A | No | Record creation time (upload time) |
| updated_at | Timestamp | N/A | No | Last update time |

**Timefields Clarification:**
- `captured_at`: The actual moment the violation occurred (e.g., from the ESP32 camera).
- `created_at`: When the record was saved to the database.

---

### 3. **sms_logs** Collection
**Purpose**: Tracks SMS notifications sent to violators for audit and debugging.

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | String | N/A | No | Auto-generated Document ID |
| violation_id | String | N/A | No | Reference to `violations` document ID |
| phone_number | String | 20 | No | Recipient number |
| message | String | N/A | No | SMS content body |
| status | String | N/A | No | 'sent', 'failed' |
| api_response | String/JSON| N/A | Yes | Raw response from SMS provider API |
| created_at | Timestamp | N/A | No | Send time |

---

### 4. **audit_logs** Collection
**Purpose**: Comprehensive audit trail for security and compliance.

| Field Name | Data Type | Length | Null | Description |
|------------|-----------|--------|------|-------------|
| id | String | N/A | No | Auto-generated Document ID |
| user_id | String | N/A | Yes | Reference to `users` document ID |
| action | String | 100 | No | Action type (e.g., 'LOGIN_SUCCESS') |
| table_name | String | 50 | Yes | Affected collection name |
| record_id | String | N/A | Yes | Affected document ID |
| old_values | Object | N/A | Yes | Snapshot of data before change |
| new_values | Object | N/A | Yes | Snapshot of data after change |
| ip_address | String | 45 | Yes | User's IP address |
| user_agent | String | N/A | Yes | Browser/client info |
| created_at | Timestamp | N/A | No | Action time |

---

### 5. **system_settings** Collection
**Purpose**: Configuration management.
**Structure**: A **single document** contains all system-wide settings as fields.

| Field Name (Key) | Data Type | Length | Null | Description |
|------------------|-----------|--------|------|-------------|
| system_name | String | 100 | No | Name of the application |
| system_description | String | 255 | Yes | Description text |
| session_timeout | Number | N/A | No | User session timeout (minutes) |
| sms_enabled | Boolean | N/A | No | Master switch for SMS sending |
| admin_email | String | 100 | Yes | Contact email for system admin |
| date_format | String | 20 | No | Preferred date display format |
| currency | String | 10 | No | Currency symbol (e.g., "PHP") |
| ... | ... | ... | ... | Other configuration fields |

*Note: Unlike a Key-Value table, this is implemented as a single JSON-like document for efficient loading.*

---

## 🔗 Logical Relationships (NoSQL)

Since Firestore is non-relational, "relationships" are logical references. We use specific notations to represent these in the ERD:

### 📐 ERD Notation Guide

**1. Line Types (Why Solid or Dashed?)**
*   **Solid Line (Physical Link)**: Represents a strong, database-enforced reference.
    *   *Usage*: When Table A has an actual column (ID) pointing to Table B.
    *   *Example*: `violations` has `enforcer_id`, so the line to `users` is **Solid**.
*   **Dashed Line (Logical Dependency)**: Represents a software-level dependency without a direct database link.
    *   *Usage*: When a User manages a dataset but has no foreign key connecting them.
    *   *Example*: `users` (Admin) manages `system_settings`, but they don't share IDs. The connection exists in the **Application Logic**, so the line is **Dashed**.

**2. Cardinality (Why One-to-Many vs One-to-One?)**
*   **One-to-Many (1:N)**: Used when a single record in Parent Table owns multiple records in Child Table.
    *   *Users → Violations*: One Enforcer issues **Many** violations.
    *   *Violations → SMS Logs*: One Violation can have **Many** SMS updates (Created, Reminder 1, Reminder 2).
*   **One-to-One (1:1)**: Used when a single record connects to exactly one other record or singleton.
    *   *Users → System Settings*: Only **One** Admin role manages the **One** global settings document.

### Relationship Specifics

1.  **users → violations (Solid, 1:N)**
    *   **Reason**: Physical `enforcer_id` exists in violations.
    *   **Logic**: An enforcer's daily duty involves issuing multiple tickets, hence "Many".

2.  **violations → sms_logs (Solid, 1:N)**
    *   **Reason**: Physical `violation_id` exists in sms_logs.
    *   **Logic**: A single violation lifecycle (Issued -> Reminder -> Paid) triggers multiple SMS notifications over time.

3.  **users → audit_logs (Solid, 1:N)**
    *   **Reason**: Physical `user_id` exists in audit_logs.
    *   **Logic**: A single user performs thousands of actions (Login, Update, Delete) over their lifetime.

4.  **users → system_settings (Dashed, 1:1)**
    *   **Reason**: No foreign key (ID) connects them.
    *   **Logic**: The Admin user has permission to edit the Global Settings. This is a dependency, not a parent-child relationship.


## 🔧 Database Setup

The database is initialized automatically via the Firebase Admin SDK.
- **Connection**: `server/config/database.js` and `firebase.js`.
- **Credentials**: Uses Service Account or Google Application Default Credentials.

### Environment Variables
```env
FIREBASE_PROJECT_ID=your-project-id
# For local dev with service account:
FIREBASE_SERVICE_ACCOUNT_KEY={"type": "service_account", ...}
```
