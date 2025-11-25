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
- **Penalty Reminders**: Automatic reminders for overdue violations (sent daily)

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

## 📋 API Endpoints

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
| GET | `/api/admin/users` | Get all users |
| POST | `/api/admin/users` | Create new user |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/settings` | Get system settings |
| PUT | `/api/admin/settings` | Update system settings |
| GET | `/api/admin/dashboard` | Get dashboard data |

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

### Penalty Reminder Notifications

The system automatically sends penalty reminders for overdue violations:

- **Schedule**: Runs daily at 9:00 AM (Philippine Time)
- **Trigger**: Enabled in production or when `ENABLE_PENALTY_REMINDERS=true`
- **Manual Execution**: Run `npm run send-penalty-reminders` to send reminders manually

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
