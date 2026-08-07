#!/bin/bash

# Spindly.app-only Deployment Script
# Builds and deploys only the spindly.app landing page to production

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

if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$SPINDLY_DEPLOY_PATH" ]; then
    print_error "Missing required configuration. Please check deploy.config"
    exit 1
fi

if [ ! -f "$SFTP_KEY_PATH" ]; then
    print_error "SSH key file not found: $SFTP_KEY_PATH"
    exit 1
fi

SPINDLY_BUILD_COMMAND=${SPINDLY_BUILD_COMMAND:-"npm run build"}

print_status "Starting Spindly.app deployment..."
print_status "Target server: $SFTP_USER@$PRODUCTION_HOST"
print_status "Spindly path: $SPINDLY_DEPLOY_PATH"

# Build
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping build"
    [ ! -d "$SCRIPT_DIR/dist/spindly-web/browser" ] && { print_error "dist directory not found. Build first or run without --skip-build"; exit 1; }
    end_phase "Build: Spindly (skipped)"
else
    print_status "Building Spindly.app..."
    cd "$SCRIPT_DIR"
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    [ -f "src/environments/environment.prod.example.ts" ] && \
        cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
    eval "$SPINDLY_BUILD_COMMAND"
    rm -f src/environments/environment.prod.ts
    [ ! -d "dist/spindly-web/browser" ] && { print_error "Spindly build failed - dist directory not found"; exit 1; }
    print_success "Spindly build completed"
    end_phase "Build: Spindly"
fi

# Clean server directory
start_phase
print_status "Cleaning Spindly server directory..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "if [ -d '$SPINDLY_DEPLOY_PATH' ]; then rm -rf $SPINDLY_DEPLOY_PATH/*; else mkdir -p $SPINDLY_DEPLOY_PATH; fi"
print_success "Spindly server directory cleaned"
end_phase "Prepare: Clean server"

# Upload
start_phase
print_status "Uploading Spindly.app files..."
if tar czf - -C "$SCRIPT_DIR/dist/spindly-web/browser" . | \
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
        "$SFTP_USER@$PRODUCTION_HOST" "tar xzf - -C $SPINDLY_DEPLOY_PATH"; then
    print_success "✅ Spindly.app deployed and live!"
else
    print_error "Failed to upload Spindly.app files"
    exit 1
fi
end_phase "Deploy: Spindly"

DEPLOY_TOTAL=$(( $(date +%s) - DEPLOY_START ))
echo ""
print_success "🎉 Spindly.app deployment completed in $(format_duration $DEPLOY_TOTAL)"
echo ""
for i in "${!PHASE_NAMES[@]}"; do
    print_success "  ✅ ${PHASE_NAMES[$i]} — $(format_duration ${PHASE_DURATIONS[$i]})"
done
echo ""
print_status "Total deployment time: $(format_duration $DEPLOY_TOTAL)"
