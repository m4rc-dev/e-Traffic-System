# e-Traffic System

A centralized platform for managing traffic violation records captured by handheld IoT devices. Built with React.js, Node.js, and MySQL.

## 🚀 Features

### Administrator Dashboard
- **Modern UI/UX**: Built with React.js, Tailwind CSS, and Chart.js
- **Real-time Analytics**: Live dashboard with violation statistics and charts
- **Enforcer Management**: Create, edit, and manage traffic enforcer accounts
- **Violation Monitoring**: View and manage all traffic violations
- **Report Generation**: Generate daily, weekly, and monthly reports
- **System Settings**: Configure SMS notifications and system parameters

### User Authentication & Role Management
- **Single Administrator Access**: Exclusive admin access to the web system
- **Traffic Enforcer Login**: Enforcers log in to IoT devices for field data entry
- **JWT-based Security**: Encrypted token-based sessions for both admin and enforcers
- **Role-based Access Control**: Different permissions for admin and enforcer roles

### Violation Records Management
- **Real-time Updates**: Live violation records from IoT devices via HTTP
- **Search & Filter**: Advanced search and filtering capabilities
- **Status Tracking**: Track violation status (pending, issued, paid, disputed, cancelled)
- **Evidence Management**: Support for photo evidence and location data

### SMS Notification Integration
- **Automated Notifications**: Send violation notices via SMS gateway API
- **Delivery Tracking**: Monitor SMS delivery status
- **Configurable Messages**: Customizable SMS templates

### Report Management
- **Multiple Formats**: Generate reports in JSON and CSV formats
- **Interactive Charts**: Visual data representation with Chart.js
- **Export Capabilities**: Download reports for external use
- **Performance Analytics**: Enforcer performance tracking

## 🛠️ Technology Stack

### Frontend
- **React.js 18**: Modern UI framework
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Data visualization
- **React Query**: Server state management
- **React Hook Form**: Form handling
- **Lucide React**: Icon library

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **MySQL**: Database
- **JWT**: Authentication
- **bcryptjs**: Password hashing
- **Axios**: HTTP client

### Communication
- **HTTP/JSON**: IoT devices → Server communication
- **SMS Gateway API**: Violation notifications
- **RESTful API**: Standard API endpoints

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v16 or higher)
- **MySQL** (v8.0 or higher)
- **npm** or **yarn**

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd e-traffic-system
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all dependencies (root, server, and client)
npm run install-all
```

### 3. Database Setup

1. **Create MySQL Database**
   ```sql
   CREATE DATABASE e_traffic_db;
   ```

2. **Configure Environment Variables**
   ```bash
   # Copy the environment template
   cp server/env.example server/.env
   
   # Edit the .env file with your database credentials
   nano server/.env
   ```

3. **Run Database Setup**
   ```bash
   npm run setup-db
   ```

### 4. Configure Environment Variables

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=e_traffic_db
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# SMS Gateway Configuration
SMS_API_KEY=your_sms_api_key
SMS_API_URL=https://api.smsgateway.com/send
SMS_SENDER_ID=E_TRAFFIC

# Admin Default Credentials
ADMIN_EMAIL=admin@etraffic.com
ADMIN_PASSWORD=admin123

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Start the Application

```bash
# Start both frontend and backend in development mode
npm run dev

# Or start them separately:
npm run server  # Backend only
npm run client  # Frontend only
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 🔐 Default Login Credentials

After running the database setup, you can log in with:

- **Email**: admin@etraffic.com
- **Password**: admin123

**⚠️ Important**: Change the default password after first login!

## 📱 IoT Device Integration

### API Endpoints for IoT Devices

IoT devices should use the following endpoints for data transmission:

#### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "enforcer@example.com",
  "password": "password"
}
```

#### Create Violation
```http
POST /api/violations
Authorization: Bearer <token>
Content-Type: application/json

{
  "violator_name": "John Doe",
  "violator_license": "DL123456",
  "violator_phone": "+1234567890",
  "violator_address": "123 Main St",
  "vehicle_plate": "ABC123",
  "vehicle_model": "Toyota Camry",
  "vehicle_color": "Red",
  "violation_type": "Speeding",
  "violation_description": "Exceeded speed limit by 20 mph",
  "location": "Main Street & 5th Avenue",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "fine_amount": 150.00,
  "evidence_photos": ["base64_encoded_image_1", "base64_encoded_image_2"],
  "notes": "Additional notes"
}
```

### Sample IoT Device Code (JavaScript)

```javascript
const createViolation = async (violationData) => {
  try {
    const response = await fetch('http://your-server:5000/api/violations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(violationData)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error creating violation:', error);
    throw error;
  }
};
```

## 📊 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/change-password` | Change password |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Get dashboard statistics |
| GET | `/api/admin/enforcers` | Get all enforcers |
| POST | `/api/admin/enforcers` | Create new enforcer |
| PUT | `/api/admin/enforcers/:id` | Update enforcer |
| DELETE | `/api/admin/enforcers/:id` | Delete enforcer |
| GET | `/api/admin/settings` | Get system settings |
| PUT | `/api/admin/settings` | Update system settings |

### Violations Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/violations` | Get all violations |
| GET | `/api/violations/:id` | Get single violation |
| POST | `/api/violations` | Create new violation |
| PUT | `/api/violations/:id` | Update violation |
| DELETE | `/api/violations/:id` | Delete violation |
| GET | `/api/violations/stats/overview` | Get violation statistics |

### Reports Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/violations` | Generate violations report |
| GET | `/api/reports/enforcers` | Generate enforcers report |
| GET | `/api/reports/daily-summary` | Get daily summary |
| GET | `/api/reports/monthly` | Get monthly report |

## 🔧 Configuration

### SMS Gateway Setup

To enable SMS notifications, configure your SMS gateway in the `.env` file:

```env
SMS_API_KEY=your_sms_api_key
SMS_API_URL=https://api.smsgateway.com/send
SMS_SENDER_ID=E_TRAFFIC
```

### System Settings

Configure system settings through the admin dashboard:

- **SMS Enabled**: Enable/disable SMS notifications
- **Fine Due Days**: Number of days before fine is due
- **Max Photos**: Maximum photos per violation
- **System Name**: Display name for the system
- **Contact Email**: System contact email

## 🚀 Deployment

### Production Build

```bash
# Build the frontend
npm run build

# Start production server
npm start
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
JWT_SECRET=your-production-jwt-secret
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions, please contact:
- Email: support@etraffic.com
- Documentation: [Link to documentation]

## 🔄 Updates

Stay updated with the latest features and bug fixes by regularly pulling from the main branch:

```bash
git pull origin main
npm run install-all
npm run setup-db
```

---

**e-Traffic System** - Modern traffic violation management for the digital age.
