# Database Migrations

This project uses Sequelize CLI for database migrations to manage schema changes in a version-controlled way.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure your `.env` file has the correct database credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=meltrecords_dashboard
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

## Available Migration Commands

### Run Migrations
Apply all pending migrations:
```bash
npm run db:migrate
```

### Undo Migrations
Undo the last migration:
```bash
npm run db:migrate:undo
```

Undo all migrations (be careful!):
```bash
npm run db:migrate:undo:all
```

### Check Migration Status
See which migrations have been applied:
```bash
npm run db:migrate:status
```

### Generate New Migration
Create a new migration file:
```bash
npm run migration:generate add-new-column
```

## Current Migrations

### 20250109000001-example-migration.js
This is an example migration file that demonstrates the migration structure but makes no actual database changes. It serves as:
- A template for future migrations
- A test to ensure the migration system is working
- Documentation of migration best practices

When you need to make actual database changes, you can copy this file as a starting point.

## Migration Best Practices

1. **Always test migrations** in a development environment first
2. **Backup your database** before running migrations in production
3. **Check migration status** before and after running migrations
4. **Write reversible migrations** - always implement the `down` method
5. **Use descriptive names** for migration files
6. **Check if columns exist** before adding them (to prevent errors on re-runs)

## Example: Running the Dashboard Images Migration

```bash
# Check current status
npm run db:migrate:status

# Run the migration
npm run db:migrate

# Verify it was applied
npm run db:migrate:status
```

## Rollback Example

If you need to rollback the dashboard images migration:

```bash
# Undo the last migration
npm run db:migrate:undo
```

## File Structure

```
src/
├── config/
│   ├── database.js    # JavaScript config for Sequelize CLI
│   └── database.ts    # TypeScript config for application
├── models/            # Sequelize model definitions
migrations/            # Migration files
.sequelizerc          # Sequelize CLI configuration
```

## Notes

- Migration files use JavaScript (not TypeScript) as required by Sequelize CLI
- The database config is duplicated (database.js for CLI, database.ts for app)
- Migrations are run in chronological order based on the timestamp in the filename
- Each migration creates an entry in the `SequelizeMeta` table to track applied migrations