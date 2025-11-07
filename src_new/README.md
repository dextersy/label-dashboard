# Label Dashboard - Angular + Node.js Migration

This directory contains the new Angular + Node.js implementation of the original PHP Label Dashboard application.

## Project Structure

```
src_new/
├── label-dashboard-api/     # Node.js Express API server
└── label-dashboard-web/     # Angular frontend application
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MySQL database
- npm or yarn package manager

### 1. API Server Setup (label-dashboard-api)

```bash
cd label-dashboard-api

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database and configuration details

# Start development server
npm run dev
```

The API server will start on `http://localhost:3000`

**API Endpoints:**
- `GET /api/health` - Server health check
- `GET /api/db-test` - Database connection test
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info (requires authentication)

### 2. Angular Frontend Setup (label-dashboard-web)

```bash
cd label-dashboard-web

# Install dependencies
npm install

# Start development server
ng serve
```

The Angular app will start on `http://localhost:4200`

## Features Implemented

### ✅ Completed
- **Project Structure**: Both Angular and Node.js projects created and configured
- **Database Models**: TypeScript models for User and Brand entities
- **Authentication System**: JWT-based authentication with login/logout
- **Basic Components**: Login, Dashboard, Navbar, Sidebar components created
- **Security Middleware**: Authentication and authorization middleware
- **TypeScript Configuration**: Full TypeScript support for the API

### 🚧 In Progress
- **API Routes**: Converting PHP endpoints to Express routes
- **Angular Components**: Implementing PHP views as Angular components
- **Database Integration**: Full model relationships and data access

### 📋 To Do
- **Complete Model Conversion**: Artist, Release, Event, Payment, etc.
- **Frontend Routing**: Angular routing with guards
- **UI Components**: Dashboard layout, forms, tables
- **File Upload**: AWS S3 integration for document/image uploads
- **Email Service**: Nodemailer configuration for notifications
- **Payment Integration**: PayMongo API integration

## Key Technologies

### Backend (Node.js API)
- **Express.js** - Web framework
- **Sequelize** - ORM for MySQL
- **JWT** - Authentication tokens
- **TypeScript** - Type safety
- **bcryptjs** - Password hashing (migrating from MD5)
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

### Frontend (Angular)
- **Angular 17** - Frontend framework
- **TypeScript** - Type safety
- **SCSS** - Styling
- **RxJS** - Reactive programming
- **HTTP Client** - API communication

## Database Migration Notes

The original PHP application uses MD5 password hashing. The new system supports both MD5 (for migration compatibility) and bcrypt (for new passwords). It's recommended to gradually migrate users to bcrypt hashing.

## Development Workflow

1. **API Development**: Add new endpoints in `src/routes/`
2. **Model Creation**: Define Sequelize models in `src/models/`
3. **Frontend Components**: Create Angular components in `src/app/components/`
4. **Services**: Add Angular services in `src/app/services/`

## Original PHP Structure Analysis

The original application includes:
- **User Management**: Multi-brand user system with role-based access
- **Artist Management**: Artist profiles, releases, documents, and images
- **Event Management**: Ticket sales and event tracking
- **Financial Management**: Earnings, payments, royalties, and expenses
- **Brand Management**: Multi-tenant brand system
- **File Management**: AWS S3 integration for uploads

## Next Steps

1. **Complete the Model Layer**: Implement remaining Sequelize models
2. **API Routes**: Convert all PHP actions to Express endpoints
3. **Frontend Implementation**: Build Angular components matching PHP views
4. **Testing**: Add unit and integration tests
5. **Deployment**: Configure production environment

## Configuration

### Environment Variables (.env)
```
# Database
DB_SERVER=localhost
DB_DATABASE=meltrecords_dashboard
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret

# AWS S3
S3_BUCKET=your_bucket
S3_ACCESS_KEY=your_key
S3_SECRET_KEY=your_secret
S3_REGION=ap-southeast-1
```

## Support

For questions or issues with the migration, refer to the original PHP codebase structure in the `src/` directory for reference implementation details.