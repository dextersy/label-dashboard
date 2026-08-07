#!/bin/bash

# API-only Deployment Script
# Builds and deploys only the label-dashboard-api to production

set -e

SKIP_BUILD=false
MIGRATIONS_MODE="auto"
for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-migrations)
            MIGRATIONS_MODE="skip"
            shift
            ;;
        --force-migrations)
            MIGRATIONS_MODE="force"
            shift
            ;;
        *)
            echo "Usage: $0 [--skip-build] [--skip-migrations] [--force-migrations]"
            echo "  --skip-build        Skip the build step"
            echo "  --skip-migrations   Always skip database migrations"
            echo "  --force-migrations  Always run database migrations"
            echo "  (default)           Auto-detect: run migrations only if new files exist"
            exit 1
            ;;
    esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

DEPLOY_START=$(date +%s)
PHASE_START=0
declare -a PHASE_NAMES=()
declare -a PHASE_DURATIONS=()

format_duration() {
    local secs=$1
    local mins=$((secs / 60))
    local rem=$((secs % 60))
    if [ "$mins" -gt 0 ]; then echo "${mins}m ${rem}s"; else echo "${rem}s"; fi
}

start_phase() { PHASE_START=$(date +%s); }
end_phase() {
    local name=$1
    PHASE_DURATIONS+=("$(( $(date +%s) - PHASE_START ))")
    PHASE_NAMES+=("$name")
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$ROOT_DIR/deploy.config"

if [ ! -f "$CONFIG_FILE" ]; then
    print_error "Configuration file not found: $CONFIG_FILE"
    print_error "Please copy deploy.config.template to deploy.config and update with your server details"
    exit 1
fi

print_status "Loading configuration from $CONFIG_FILE"
source "$CONFIG_FILE"

if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$BACKEND_DEPLOY_PATH" ]; then
    print_error "Missing required configuration. Please check deploy.config"
    exit 1
fi

if [ ! -f "$SFTP_KEY_PATH" ]; then
    print_error "SSH key file not found: $SFTP_KEY_PATH"
    exit 1
fi

API_BUILD_COMMAND=${API_BUILD_COMMAND:-"npm run build"}
PM2_APP_NAME=${PM2_APP_NAME:-"app"}

print_status "Starting API deployment..."
print_status "Target server: $SFTP_USER@$PRODUCTION_HOST"
print_status "Backend path: $BACKEND_DEPLOY_PATH"

has_pending_migrations() {
    local local_migrations remote_migrations
    local_migrations=$(ls "$SCRIPT_DIR/migrations/" 2>/dev/null | sort | paste -sd,)
    remote_migrations=$(ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
        "ls $BACKEND_DEPLOY_PATH/migrations/ 2>/dev/null | sort | paste -sd," 2>/dev/null || echo "")
    if [ "$local_migrations" = "$remote_migrations" ]; then return 1; else return 0; fi
}

needs_npm_install() {
    local local_hash remote_hash
    local_hash=$(md5sum "$SCRIPT_DIR/package-lock.json" 2>/dev/null | awk '{print $1}')
    remote_hash=$(ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
        "md5sum $BACKEND_DEPLOY_PATH/package-lock.json 2>/dev/null | awk '{print \$1}'" 2>/dev/null || echo "")
    if [ "$local_hash" = "$remote_hash" ] && [ -n "$local_hash" ]; then return 1; else return 0; fi
}

# Build
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping build"
    [ ! -d "$SCRIPT_DIR/dist" ] && { print_error "dist directory not found. Build first or run without --skip-build"; exit 1; }
    end_phase "Build: API (skipped)"
else
    print_status "Building API..."
    cd "$SCRIPT_DIR"
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    eval "$API_BUILD_COMMAND"
    [ ! -d "dist" ] && { print_error "API build failed - dist directory not found"; exit 1; }
    print_success "API build completed"
    end_phase "Build: API"
fi

# Auto-detect migrations and npm install before cleaning server
RUN_MIGRATIONS=false
if [ "$MIGRATIONS_MODE" = "force" ]; then
    print_status "Migrations forced via --force-migrations"
    RUN_MIGRATIONS=true
elif [ "$MIGRATIONS_MODE" = "skip" ]; then
    print_warning "Migrations skipped via --skip-migrations"
else
    print_status "Auto-detecting pending migrations..."
    if has_pending_migrations; then
        print_status "New migration files detected — migrations will run"
        RUN_MIGRATIONS=true
    else
        print_warning "No new migration files detected — skipping migrations"
    fi
fi

RUN_NPM_INSTALL=false
print_status "Auto-detecting dependency changes..."
if needs_npm_install; then
    print_status "package-lock.json changed — npm install will run"
    RUN_NPM_INSTALL=true
else
    print_warning "Dependencies unchanged — skipping npm install"
fi

# Clean server directory (preserve node_modules)
start_phase
print_status "Cleaning API server directory (preserving node_modules)..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "find $BACKEND_DEPLOY_PATH -maxdepth 1 -mindepth 1 ! -name 'node_modules' ! -name '.*' -exec rm -rf {} + 2>/dev/null; mkdir -p $BACKEND_DEPLOY_PATH"
print_success "API server directory cleaned"
end_phase "Prepare: Clean server"

if [ "$RUN_MIGRATIONS" = true ]; then
    # Phase 1: Upload migration setup
    start_phase
    cd "$SCRIPT_DIR"
    print_status "Phase 1: Uploading migration setup..."
    tar czf - package.json package-lock.json .sequelizerc config migrations | \
        ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
            "$SFTP_USER@$PRODUCTION_HOST" "cd $BACKEND_DEPLOY_PATH && tar xzf -"
    end_phase "Phase 1: Upload migration setup"

    # Phase 2: Run migrations
    start_phase
    print_status "Phase 2: Running database migrations on server..."
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
        cd $BACKEND_DEPLOY_PATH
        if [ "$RUN_NPM_INSTALL" = true ]; then
            echo "Installing dependencies for migrations..."
            npm install --production
        else
            echo "Dependencies unchanged — skipping npm install"
        fi
        echo "Running database migrations..."
        NODE_ENV=production npx sequelize-cli db:migrate
EOF
    [ $? -ne 0 ] && { print_error "Database migrations failed"; exit 1; }
    print_success "Database migrations completed successfully"
    end_phase "Phase 2: Database migrations"

    # Phase 3: Remove conflicting config files
    start_phase
    print_status "Phase 3: Removing config.js to avoid conflicts..."
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
        rm -f $BACKEND_DEPLOY_PATH/config/config.js
        rm -f $BACKEND_DEPLOY_PATH/config/database.js
EOF
    print_success "Conflicting config files removed"
    end_phase "Phase 3: Config conflicts resolved"
else
    start_phase
    print_status "Phases 1-3: Skipping migrations — uploading package files and migrations folder..."
    cd "$SCRIPT_DIR"
    tar czf - package.json package-lock.json migrations | \
        ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
            "$SFTP_USER@$PRODUCTION_HOST" "cd $BACKEND_DEPLOY_PATH && tar xzf -"
    if [ "$RUN_NPM_INSTALL" = true ]; then
        ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
        cd $BACKEND_DEPLOY_PATH
        npm install --production
EOF
    else
        print_warning "Dependencies unchanged — skipping npm install"
    fi
    end_phase "Phases 1-3: Migrations skipped"
fi

# Phase 4: Upload compiled dist
start_phase
print_status "Phase 4: Uploading compiled API files..."
if tar czf - -C "$SCRIPT_DIR/dist" . | \
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
        "$SFTP_USER@$PRODUCTION_HOST" "tar xzf - -C $BACKEND_DEPLOY_PATH"; then
    print_success "API dist files uploaded"
else
    print_error "Failed to upload API dist files"
    exit 1
fi
end_phase "Phase 4: Upload API dist files"

# Phase 5: Restart PM2
start_phase
print_status "Phase 5: Restarting PM2 application: $PM2_APP_NAME"
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
    cd $BACKEND_DEPLOY_PATH
    pm2 restart $PM2_APP_NAME || pm2 start app.js --name $PM2_APP_NAME
    pm2 status
EOF
[ $? -ne 0 ] && { print_error "Failed to restart PM2 application"; exit 1; }
print_success "✅ Phase 5: PM2 application '$PM2_APP_NAME' restarted successfully"
end_phase "Phase 5: PM2 restart"

DEPLOY_TOTAL=$(( $(date +%s) - DEPLOY_START ))
echo ""
print_success "🎉 API deployment completed in $(format_duration $DEPLOY_TOTAL)"
echo ""
for i in "${!PHASE_NAMES[@]}"; do
    print_success "  ✅ ${PHASE_NAMES[$i]} — $(format_duration ${PHASE_DURATIONS[$i]})"
done
echo ""
print_status "Total deployment time: $(format_duration $DEPLOY_TOTAL)"
