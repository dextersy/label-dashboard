#!/bin/bash

# Web Frontend-only Deployment Script
# Builds and deploys only the label-dashboard-web to production

set -e

SKIP_BUILD=false
for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo "Usage: $0 [--skip-build]"
            echo "  --skip-build  Skip the build step"
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

if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$FRONTEND_DEPLOY_PATH" ]; then
    print_error "Missing required configuration. Please check deploy.config"
    exit 1
fi

if [ ! -f "$SFTP_KEY_PATH" ]; then
    print_error "SSH key file not found: $SFTP_KEY_PATH"
    exit 1
fi

WEB_BUILD_COMMAND=${WEB_BUILD_COMMAND:-"npm run build"}

print_status "Starting Web frontend deployment..."
print_status "Target server: $SFTP_USER@$PRODUCTION_HOST"
print_status "Frontend path: $FRONTEND_DEPLOY_PATH"

# Build
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping build"
    [ ! -d "$SCRIPT_DIR/dist-prod" ] && { print_error "dist-prod directory not found. Build first or run without --skip-build"; exit 1; }
    end_phase "Build: Web (skipped)"
else
    print_status "Building Web application..."
    cd "$SCRIPT_DIR"
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    [ -z "$GOOGLE_MAPS_API_KEY" ] && [ -n "$GOOGLE_MAPS_API_KEY_CONFIG" ] && \
        GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY_CONFIG"
    if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
        print_warning "Google Maps API key not set — Google Places autocomplete may not work"
    elif [ -f "src/environments/environment.prod.example.ts" ]; then
        cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
        sed -i "s/YOUR_PRODUCTION_GOOGLE_PLACES_API_KEY_HERE/$GOOGLE_MAPS_API_KEY/g" src/environments/environment.prod.ts
    fi
    eval "$WEB_BUILD_COMMAND"
    rm -f src/environments/environment.prod.ts
    [ ! -d "dist-prod" ] && { print_error "Web build failed - dist-prod directory not found"; exit 1; }
    print_success "Web build completed"
    end_phase "Build: Web"
fi

# Clean and activate maintenance mode
start_phase
print_status "Cleaning Web server directory..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "if [ -d '$FRONTEND_DEPLOY_PATH' ]; then rm -rf $FRONTEND_DEPLOY_PATH/*; else mkdir -p $FRONTEND_DEPLOY_PATH; fi"
print_success "Web server directory cleaned"

print_status "Deploying maintenance mode..."
cd "$ROOT_DIR"
sftp_batch=$(mktemp)
cat > "$sftp_batch" << EOF
put maintenance.html $FRONTEND_DEPLOY_PATH/maintenance.html
put maintenance.htaccess $FRONTEND_DEPLOY_PATH/.htaccess
quit
EOF
if sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"; then
    print_success "Maintenance mode activated"
else
    print_warning "Failed to activate maintenance mode (non-critical)"
fi
rm -f "$sftp_batch"
end_phase "Prepare: Clean & maintenance mode"

# Upload production files (excluding .htaccess to preserve maintenance mode during transfer)
start_phase
print_status "Uploading Web application files..."
cd "$SCRIPT_DIR"
if tar czf - -C dist-prod/browser --exclude='.htaccess' . | \
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
        "$SFTP_USER@$PRODUCTION_HOST" "tar xzf - -C $FRONTEND_DEPLOY_PATH"; then
    print_success "Production files uploaded"
else
    print_error "Failed to upload production files"
    exit 1
fi

# Replace .htaccess last to switch from maintenance mode to production
print_status "Switching from maintenance mode to production..."
scp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
    dist-prod/browser/.htaccess "$SFTP_USER@$PRODUCTION_HOST:$FRONTEND_DEPLOY_PATH/.htaccess"

# Clean up maintenance.html
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "rm -f $FRONTEND_DEPLOY_PATH/maintenance.html"

print_success "✅ Web frontend deployed and live!"
end_phase "Deploy: Web frontend"

DEPLOY_TOTAL=$(( $(date +%s) - DEPLOY_START ))
echo ""
print_success "🎉 Web deployment completed in $(format_duration $DEPLOY_TOTAL)"
echo ""
for i in "${!PHASE_NAMES[@]}"; do
    print_success "  ✅ ${PHASE_NAMES[$i]} — $(format_duration ${PHASE_DURATIONS[$i]})"
done
echo ""
print_status "Total deployment time: $(format_duration $DEPLOY_TOTAL)"
