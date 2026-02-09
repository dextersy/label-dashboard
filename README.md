# Melt Records Artist Dashboard

At Melt Records, we believe in *transparency* first and foremost - that we should NOT be afraid to share and engage in conversations with our artist regarding what we do, how we do it, and how much we make out of it.

This dashboard is an effort to exemplify this value, by providing our artists easy access to as much information as is available, without obscuring the important details.

To further encourage transparency, we've released this dashboard as a public and open-source repository, so others may use it freely for their own purposes and audit the implementation to make sure that calculations and other things are carried out correctly.

Feel free to fork this repository for your own modifications. I'd be happy to get your contributions to this dashboard!

\- **Dexter Sy**, Melt Records

## Architecture

The project consists of three main components:

| Component | Directory | Tech Stack |
|---|---|---|
| Backend API | `src_new/label-dashboard-api/` | Node.js, TypeScript, Express, Sequelize |
| Frontend | `src_new/label-dashboard-web/` | Angular, Bootstrap |
| Scheduled Jobs | `src_new/label-dashboard-jobs/` | TypeScript, AWS Lambda |
| Legacy App | `src/` | PHP (deprecated, do not modify) |

### Key Features
- **Multi-brand support** - domain-based routing with brand-specific styling and isolated data
- **Role-based access control** - Admin, Artist, and Team Member roles with JWT authentication
- **Financial reporting** - Earnings, payments, royalties, and expenses tracking
- **Release management** - Albums/singles with metadata, cover art, and song tracking
- **Event management** - Live shows with ticket sales integration

## Quick Start

### Prerequisites
- Node.js (v18+)
- MySQL
- npm

### Backend API

```bash
cd src_new/label-dashboard-api
cp .env.example .env       # Configure database, SMTP, and SSL settings
npm install
npm run dev                # Start development server with nodemon
```

### Frontend

```bash
cd src_new/label-dashboard-web
npm install
npm start                  # Start Angular dev server (ng serve)
```

### Database

Create a MySQL database before starting the API:

```sql
CREATE DATABASE meltrecords_dashboard;
```

Then configure the connection details in the API's `.env` file. The API uses Sequelize ORM with auto-sync, so tables will be created automatically on first startup.

## License
Copyright 2021 Dexter Sy & Melt Records (https://www.melt-records.com)

Copyright 2019 Creative Tim (http://www.creative-tim.com)

Licensed under MIT (https://github.com/creativetimofficial/light-bootstrap-dashboard/blob/master/LICENSE.md)

## Links

- Twitter: https://twitter.com/meltrecordsph
- Facebook: https://www.facebook.com/meltrecordsph
- Instagram: https://instagram.com/meltrecordsph
