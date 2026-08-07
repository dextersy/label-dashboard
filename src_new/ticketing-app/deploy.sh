#!/bin/bash

# Ticketing App-only Deployment Script
# Builds and deploys only the ticketing-app to production

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

if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$TICKETING_APP_DEPLOY_PATH" ]; then
    print_error "Missing required configuration. Please check deploy.config"
    exit 1
fi

if [ ! -f "$SFTP_KEY_PATH" ]; then
    print_error "SSH key file not found: $SFTP_KEY_PATH"
    exit 1
fi

TICKETING_BUILD_COMMAND=${TICKETING_BUILD_COMMAND:-"npm run build"}

print_status "Starting Ticketing App deployment..."
print_status "Target server: $SFTP_USER@$PRODUCTION_HOST"
print_status "Ticketing App path: $TICKETING_APP_DEPLOY_PATH"

# Build
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping build"
    [ ! -d "$SCRIPT_DIR/dist/ticketing-app/browser" ] && { print_error "dist directory not found. Build first or run without --skip-build"; exit 1; }
    end_phase "Build: Ticketing App (skipped)"
else
    print_status "Building Ticketing App..."
    cd "$SCRIPT_DIR"
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    if [ -f "src/environments/environment.prod.example.ts" ]; then
        cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
        [ -z "$GOOGLE_MAPS_API_KEY" ] && [ -n "$GOOGLE_MAPS_API_KEY_CONFIG" ] && \
            GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY_CONFIG"
        [ -n "$GOOGLE_MAPS_API_KEY" ] && \
            sed -i "s/YOUR_PRODUCTION_GOOGLE_MAPS_API_KEY_HERE/$GOOGLE_MAPS_API_KEY/g" src/environments/environment.prod.ts
        if [ -n "$TICKETING_APP_PUBLIC_LISTING_DOMAIN" ]; then
            sed -i "s/YOUR_PUBLIC_LISTING_DOMAIN_HERE/$TICKETING_APP_PUBLIC_LISTING_DOMAIN/g" src/environments/environment.prod.ts
        else
            print_warning "TICKETING_APP_PUBLIC_LISTING_DOMAIN not set — placeholder left as-is"
        fi
    fi
    eval "$TICKETING_BUILD_COMMAND"
    rm -f src/environments/environment.prod.ts
    [ ! -d "dist/ticketing-app/browser" ] && { print_error "Ticketing App build failed - dist directory not found"; exit 1; }
    print_success "Ticketing App build completed"
    end_phase "Build: Ticketing App"
fi

# Clean server directory
start_phase
print_status "Cleaning Ticketing App server directory..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "if [ -d '$TICKETING_APP_DEPLOY_PATH' ]; then rm -rf $TICKETING_APP_DEPLOY_PATH/*; else mkdir -p $TICKETING_APP_DEPLOY_PATH; fi"
print_success "Ticketing App server directory cleaned"
end_phase "Prepare: Clean server"

# Substitute API URL in .htaccess for SEO crawler redirects
HTACCESS_PATH="$SCRIPT_DIR/dist/ticketing-app/browser/.htaccess"
if [ -f "$HTACCESS_PATH" ]; then
    if [ -n "$TICKETING_API_URL" ]; then
        sed -i "s|YOUR_API_URL_HERE|$TICKETING_API_URL|g" "$HTACCESS_PATH"
        print_status "Ticketing app .htaccess: substituted API URL for SEO crawler rules"
    else
        print_warning "TICKETING_API_URL not set in deploy.config — SEO crawler redirects in .htaccess will be broken"
    fi
fi

# Upload
start_phase
print_status "Uploading Ticketing App files..."
if tar czf - -C "$SCRIPT_DIR/dist/ticketing-app/browser" . | \
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
        "$SFTP_USER@$PRODUCTION_HOST" "tar xzf - -C $TICKETING_APP_DEPLOY_PATH"; then
    print_success "✅ Ticketing App deployed and live!"
else
    print_error "Failed to upload Ticketing App files"
    exit 1
fi
end_phase "Deploy: Ticketing App"

DEPLOY_TOTAL=$(( $(date +%s) - DEPLOY_START ))
echo ""
print_success "🎉 Ticketing App deployment completed in $(format_duration $DEPLOY_TOTAL)"
echo ""
for i in "${!PHASE_NAMES[@]}"; do
    print_success "  ✅ ${PHASE_NAMES[$i]} — $(format_duration ${PHASE_DURATIONS[$i]})"
done
echo ""
print_status "Total deployment time: $(format_duration $DEPLOY_TOTAL)"
