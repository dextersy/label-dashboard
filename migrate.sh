#!/bin/bash

# Migration-only script — runs pending Sequelize migrations on the production server
# without building or deploying any application code.
#
# Usage: bash migrate.sh [--force]
#   --force  Skip the pending-migration check and always run migrations

set -e

FORCE=false
for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Usage: $0 [--force]"
      echo "  --force  Always run migrations, skipping the pending-check"
      exit 1
      ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"

if [ ! -f "$CONFIG_FILE" ]; then
  print_error "Configuration file not found: $CONFIG_FILE"
  print_error "Copy deploy.config.template to deploy.config and fill in your server details."
  exit 1
fi

print_status "Loading configuration from $CONFIG_FILE"
source "$CONFIG_FILE"

if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$BACKEND_DEPLOY_PATH" ]; then
  print_error "Missing required configuration (SFTP_KEY_PATH, PRODUCTION_HOST, SFTP_USER, BACKEND_DEPLOY_PATH). Check deploy.config."
  exit 1
fi

if [ ! -f "$SFTP_KEY_PATH" ]; then
  print_error "SSH key not found: $SFTP_KEY_PATH"
  exit 1
fi

API_DIR="$SCRIPT_DIR/src_new/label-dashboard-api"

# ── Pending-migration check (same logic as deploy.sh) ─────────────────────────
has_pending_migrations() {
  local local_migrations remote_migrations
  local_migrations=$(ls "$API_DIR/migrations/" 2>/dev/null | sort | paste -sd,)
  remote_migrations=$(ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "ls $BACKEND_DEPLOY_PATH/migrations/ 2>/dev/null | sort | paste -sd," 2>/dev/null || echo "")
  [ "$local_migrations" != "$remote_migrations" ]
}

if [ "$FORCE" = false ]; then
  print_status "Checking for pending migrations..."
  if ! has_pending_migrations; then
    print_warning "No new migration files detected. Use --force to run anyway."
    exit 0
  fi
  print_status "New migration files detected."
fi

# ── Phase 1: Upload migration setup ───────────────────────────────────────────
print_status "Phase 1: Uploading migration files and config to server..."
cd "$API_DIR"
tar czf - package.json package-lock.json .sequelizerc config migrations | \
  ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
      "$SFTP_USER@$PRODUCTION_HOST" "cd $BACKEND_DEPLOY_PATH && tar xzf -"
print_success "Migration setup uploaded."

# ── Phase 2: Run migrations ────────────────────────────────────────────────────
print_status "Phase 2: Running database migrations on server..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
  cd $BACKEND_DEPLOY_PATH

  # Install dependencies only if node_modules is missing
  if [ ! -d "node_modules" ]; then
    echo "node_modules not found — running npm install..."
    npm install --production
  fi

  echo "Running migrations..."
  NODE_ENV=production npx sequelize-cli db:migrate
EOF

if [ $? -ne 0 ]; then
  print_error "Migrations failed."
  exit 1
fi
print_success "Migrations completed."

# ── Phase 3: Remove config.js to avoid conflicts with the running API ──────────
print_status "Phase 3: Removing migration config files to avoid API conflicts..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
  rm -f $BACKEND_DEPLOY_PATH/config/config.js
  rm -f $BACKEND_DEPLOY_PATH/config/database.js
  echo "Config files removed."
EOF
print_success "Cleanup done."

print_success "🎉 Migration run complete. The running API was NOT restarted."
