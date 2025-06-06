# Timebank System

A modern web-based timebank management solution built with Next.js 14, TypeScript, Tailwind CSS, and Firebase. The system efficiently manages prepaid hours for clients with automatic deduction, status tracking, and email notifications.

## Features

- **User Roles**: Admin, Project Manager, Developer with role-based access control
- **Client Management**: Complete CRUD operations for client information
- **Timebank System**: Create and manage prepaid hour packages with automatic status indicators
- **Project Management**: Link projects to clients and assign team members
- **Time Tracking**: Log work hours with automatic deduction from timebanks
- **Dashboard**: Overview of timebanks, usage statistics, and project status
- **Email Notifications**: Automatic alerts for low, depleted, or expiring timebanks
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Firebase Firestore, Firebase Authentication
- **Email**: Nodemailer
- **UI Components**: Lucide React icons
- **Charts**: Recharts
- **Date Handling**: date-fns

## Installation

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Email service (Gmail/SMTP) for notifications

### 1. Clone and Install

```bash
git clone <repository-url>
cd timebank-system
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Authentication and Firestore Database
3. Generate a new private key for Firebase Admin SDK:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely

### 3. Environment Configuration

Create a `.env.local` file in the root directory (use `.env.local.example` as template):

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-client-email
FIREBASE_ADMIN_PRIVATE_KEY="your-private-key"

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database Setup

The application uses Firestore with the following collections:

- `users` - User profiles and roles
- `clients` - Client information
- `timebanks` - Timebank packages
- `projects` - Project details and team assignments
- `timeEntries` - Time tracking entries
- `emailNotifications` - Email notification logs

Collections will be created automatically when data is first added.

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Initial Setup

1. **Create Admin User**: Register the first user with admin role
2. **Add Clients**: Create client profiles with contact information
3. **Create Timebanks**: Set up prepaid hour packages for clients
4. **Add Projects**: Create projects and assign team members
5. **Start Tracking**: Log work hours against projects

### User Roles

#### Admin
- Full access to all features
- User management
- Client and timebank management
- Project oversight
- Time entry approval

#### Project Manager
- Client and timebank management
- Project management
- Time entry approval
- Team oversight

#### Developer
- Time tracking
- Project viewing (assigned projects only)
- Personal time entry management

### Timebank Status Indicators

- **Green**: 0-74% used
- **Yellow**: 75-89% used (low hours warning)
- **Red**: 90%+ used or depleted

### Email Notifications

Automatic notifications are sent for:
- **Low Hours**: When timebank reaches 75% usage
- **Depleted**: When timebank has 0 hours remaining
- **Expiring Soon**: When timebank expires within 30 days

To enable automatic notifications, set up a cron job to call:
```bash
curl -X POST http://localhost:3000/api/notifications
```

## Project Structure

```
timebank-system/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   ├── clients/           # Client management
│   ├── timebanks/         # Timebank management
│   ├── projects/          # Project management
│   ├── time-tracking/     # Time tracking
│   └── login/             # Authentication
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── ui/               # UI components
│   └── [feature]/        # Feature-specific components
├── contexts/             # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Libraries and configurations
│   ├── firebase/         # Firebase setup
│   └── email/            # Email service
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
└── database-schema.sql   # Database schema reference
```

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript check
```

### Key Features Implementation

#### Time Tracking with Automatic Deduction
When a time entry is logged:
1. Validates sufficient hours in selected timebank
2. Creates time entry record
3. Updates timebank hours automatically
4. Changes timebank status if depleted

#### Role-Based Access Control
- Route protection with `ProtectedRoute` component
- UI elements conditional on user role
- API endpoints validate user permissions

#### Email Notifications
- Background service checks timebank status
- Automatic email generation and sending
- Notification history tracking
- Configurable thresholds and frequencies

## Deployment

### Vercel (Recommended)

1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The application can be deployed to any Node.js hosting platform:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS/Google Cloud/Azure

## Security Considerations

- Environment variables contain sensitive data - never commit to version control
- Firebase Admin SDK private key should be stored securely
- Email credentials should use app-specific passwords
- Consider implementing additional API rate limiting for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is private and confidential. All rights reserved.

## Support

For questions, issues, or feature requests, please contact the development team.