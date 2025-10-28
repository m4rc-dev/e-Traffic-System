# e-Traffic System

A centralized platform for managing traffic violation records captured by handheld IoT devices. Built with React.js, Node.js, and Firebase Firestore.

## 🚀 Features

### Administrator Dashboard
- **Modern UI/UX**: Built with React.js, Tailwind CSS, and Chart.js
- **Real-time Analytics**: Live dashboard with violation statistics and charts
- **Enforcer Management**: Create, edit, and manage traffic enforcer accounts
- **Violation Monitoring**: View and manage all traffic violations
- **Repeat Offenders Tracking**: Monitor and track violators with multiple offenses
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
- **Repeat Offenders**: Identify and monitor frequent violators with detailed statistics
- **Mobile Responsive**: Fully optimized for mobile devices and tablets

### SMS Notification Integration
- **Automated Notifications**: Send violation notices via SMS gateway API
- **Delivery Tracking**: Monitor SMS delivery status
- **Configurable Messages**: Customizable SMS templates

### Report Management
- **Multiple Formats**: Generate reports in JSON and CSV formats
- **Interactive Charts**: Visual data representation with Chart.js
- **Export Capabilities**: Download reports for external use
- **Performance Analytics**: Enforcer performance tracking

### Repeat Offenders Management
- **Violator Tracking**: Identify violators with multiple offenses
- **Advanced Filtering**: Filter by minimum violations (2+, 3+, 5+, 10+)
- **Statistical Analysis**: View total repeat offenders, average violations, and maximum violations
- **Financial Overview**: Track total fines and outstanding balances
- **Violation History**: View first and last violation details for each offender
- **Payment Status**: Monitor payment status with visual indicators
- **Real-time Updates**: Auto-refresh every 30 seconds for live data

## 🛠️ Technology Stack

### Frontend
- **React.js 18**: Modern UI framework
- **Tailwind CSS**: Utility-first CSS framework with mobile-first responsive design
- **Chart.js**: Data visualization
- **React Query**: Server state management
- **React Hook Form**: Form handling
- **Lucide React**: Icon library
- **Recharts**: Advanced charting library for reports

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **Firebase Firestore**: NoSQL database (cloud-based)
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
- **Firebase Project**: Create a Firebase project with Firestore enabled
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

### 3. Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Firestore Database

2. **Configure Environment Variables**
   ```bash
   # Copy the environment template
   cp server/env.firebase.example server/.env
   
   # Edit the .env file with your Firebase credentials
   nano server/.env
   ```

3. **Run Database Setup**
   ```bash
   npm run setup-firebase
   ```

### 4. Configure Environment Variables

Create a `.env` file in the `server` directory using the provided template:

```bash
# Copy the environment template
cp server/env.example server/.env
```

Edit the `.env` file with your specific configuration values. See `server/env.example` for all required environment variables.

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

## 🔐 Authentication

The system uses JWT-based authentication with role-based access control. Default admin credentials are created during the initial database setup. Please refer to the environment configuration for authentication details.

## 📱 IoT Device Integration

### API Endpoints for IoT Devices

IoT devices should use the following endpoints for data transmission:

#### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "your_enforcer_email",
  "password": "your_password"
}
```

#### Create Violation
```http
POST /api/violations
Authorization: Bearer <token>
Content-Type: application/json

{
  "violator_name": "Violator Name",
  "violator_license": "License Number",
  "violator_phone": "Phone Number",
  "violator_address": "Address",
  "vehicle_plate": "Plate Number",
  "vehicle_model": "Vehicle Model",
  "vehicle_color": "Vehicle Color",
  "violation_type": "Violation Type",
  "violation_description": "Description",
  "location": "Location",
  "latitude": 0.0,
  "longitude": 0.0,
  "fine_amount": 0.00,
  "evidence_photos": ["base64_encoded_image"],
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
| GET | `/api/admin/repeat-offenders` | Get repeat offenders data |
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

To enable SMS notifications, configure your SMS gateway in the `.env` file. See `server/env.example` for the required SMS configuration variables.

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

Configure production environment variables in your deployment platform. See `server/env.example` for all required variables and their descriptions.

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions, please refer to the project documentation or create an issue in the repository.

## 🔄 Updates

Stay updated with the latest features and bug fixes by regularly pulling from the main branch:

```bash
git pull origin main
npm run install-all
npm run setup-db
```

---

**e-Traffic System** - Modern traffic violation management for the digital age.
