#!/bin/bash

# Label Dashboard Deployment Script
# This script builds and deploys both the API and Web applications to production
# Incorporates environment variable handling from deploy-example.sh

set -e  # Exit on any error

# Parse command line arguments
SKIP_BUILD=false
MIGRATIONS_MODE="auto"  # auto | skip | force
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
            # Unknown option
            echo "Usage: $0 [--skip-build] [--skip-migrations] [--force-migrations]"
            echo "  --skip-build        Skip the build step for both API and Web applications"
            echo "  --skip-migrations   Always skip database migrations"
            echo "  --force-migrations  Always run database migrations"
            echo "  (default)           Auto-detect: run migrations only if new files exist"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ── Timing ───────────────────────────────────────────────────────────────────
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
# ─────────────────────────────────────────────────────────────────────────────

# Returns 0 (true) if there are pending migrations, 1 (false) if up to date
has_pending_migrations() {
    local local_migrations
    local remote_migrations
    local_migrations=$(ls "$SCRIPT_DIR/src_new/label-dashboard-api/migrations/" 2>/dev/null | sort | paste -sd,)
    remote_migrations=$(ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
        "ls $BACKEND_DEPLOY_PATH/migrations/ 2>/dev/null | sort | paste -sd," 2>/dev/null || echo "")

    if [ "$local_migrations" = "$remote_migrations" ]; then
        return 1  # no new migrations
    else
        return 0  # new migrations found
    fi
}

# Returns 0 (true) if npm install needs to run, 1 (false) if dependencies are unchanged
needs_npm_install() {
    local local_hash remote_hash
    local_hash=$(md5sum "$SCRIPT_DIR/src_new/label-dashboard-api/package-lock.json" 2>/dev/null | awk '{print $1}')
    remote_hash=$(ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
        "md5sum $BACKEND_DEPLOY_PATH/package-lock.json 2>/dev/null | awk '{print \$1}'" 2>/dev/null || echo "")

    if [ "$local_hash" = "$remote_hash" ] && [ -n "$local_hash" ]; then
        return 1  # unchanged
    else
        return 0  # install needed
    fi
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    print_error "Configuration file not found: $CONFIG_FILE"
    print_error "Please copy deploy.config.template to deploy.config and update with your server details"
    print_error "Example: cp deploy.config.template deploy.config"
    exit 1
fi

# Load configuration
print_status "Loading configuration from $CONFIG_FILE"
source "$CONFIG_FILE"

# Validate required configuration
if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$BACKEND_DEPLOY_PATH" ] || [ -z "$FRONTEND_DEPLOY_PATH" ] || [ -z "$SPINDLY_DEPLOY_PATH" ] || [ -z "$TICKETING_APP_DEPLOY_PATH" ]; then
    print_error "Missing required configuration. Please check deploy.config"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SFTP_KEY_PATH" ]; then
    print_error "SSH key file not found: $SFTP_KEY_PATH"
    exit 1
fi

# Set default values
API_BUILD_COMMAND=${API_BUILD_COMMAND:-"npm run build"}
WEB_BUILD_COMMAND=${WEB_BUILD_COMMAND:-"npm run build"}
SPINDLY_BUILD_COMMAND=${SPINDLY_BUILD_COMMAND:-"npm run build"}
TICKETING_BUILD_COMMAND=${TICKETING_BUILD_COMMAND:-"npm run build"}
PM2_APP_NAME=${PM2_APP_NAME:-"app"}

print_status "Starting deployment process..."
print_status "Target server: $SFTP_USER@$PRODUCTION_HOST"
print_status "Backend path: $BACKEND_DEPLOY_PATH"
print_status "Frontend path: $FRONTEND_DEPLOY_PATH"
print_status "Spindly landing path: $SPINDLY_DEPLOY_PATH"
print_status "Ticketing App path: $TICKETING_APP_DEPLOY_PATH"

if [ "$SKIP_BUILD" = true ]; then
    print_warning "🚀 Fast deployment mode: Build step will be skipped"
    print_warning "Ensure applications are already built before proceeding"
fi

# Function to check if directory exists
check_directory() {
    local dir=$1
    local name=$2
    
    if [ ! -d "$dir" ]; then
        print_error "$name directory not found: $dir"
        exit 1
    fi
}

# Check project directories
check_directory "$SCRIPT_DIR/src_new/label-dashboard-api" "API"
check_directory "$SCRIPT_DIR/src_new/label-dashboard-web" "Web"
check_directory "$SCRIPT_DIR/src_new/spindly.app" "Spindly"
check_directory "$SCRIPT_DIR/src_new/ticketing-app" "Ticketing App"

# Build API
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping API build (--skip-build flag specified)"
    cd "$SCRIPT_DIR/src_new/label-dashboard-api"
    if [ ! -d "dist" ]; then
        print_error "API dist directory not found and build was skipped. Please build first or run without --skip-build"
        exit 1
    fi
    end_phase "Build: API (skipped)"
else
    print_status "Building API..."
    cd "$SCRIPT_DIR/src_new/label-dashboard-api"

    if [ ! -f "package.json" ]; then
        print_error "package.json not found in API directory"
        exit 1
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing API dependencies..."
        npm install
    fi

    # Build API
    print_status "Running API build command: $API_BUILD_COMMAND"
    eval "$API_BUILD_COMMAND"

    if [ ! -d "dist" ]; then
        print_error "API build failed - dist directory not found"
        exit 1
    fi

    print_success "API build completed"
    end_phase "Build: API"
fi

# Build Web
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping Web build (--skip-build flag specified)"
    cd "$SCRIPT_DIR/src_new/label-dashboard-web"
    if [ ! -d "dist-prod" ]; then
        print_error "Web dist-prod directory not found and build was skipped. Please build first or run without --skip-build"
        exit 1
    fi
    end_phase "Build: Web (skipped)"
else
    print_status "Building Web application..."
    cd "$SCRIPT_DIR/src_new/label-dashboard-web"

    if [ ! -f "package.json" ]; then
        print_error "package.json not found in Web directory"
        exit 1
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing Web dependencies..."
        npm install
    fi

    # Handle environment configuration for Web application
    print_status "Configuring production environment..."

    # Check if Google Maps API key is set in environment or config
    GOOGLE_MAPS_API_KEY_SOURCE=""
    if [ ! -z "$GOOGLE_MAPS_API_KEY" ]; then
        GOOGLE_MAPS_API_KEY_SOURCE="environment variable"
    elif [ ! -z "$GOOGLE_MAPS_API_KEY_CONFIG" ]; then
        GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY_CONFIG"
        GOOGLE_MAPS_API_KEY_SOURCE="deploy.config"
    fi

    if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
        print_warning "Google Maps API key not found in environment variables or deploy.config"
        print_warning "The application will build but Google Places autocomplete may not work"
        print_warning "To fix this, set GOOGLE_MAPS_API_KEY environment variable or add GOOGLE_MAPS_API_KEY_CONFIG to deploy.config"
    else
        print_status "Using Google Maps API key from $GOOGLE_MAPS_API_KEY_SOURCE"

        # Create production environment file from template
        if [ -f "src/environments/environment.prod.example.ts" ]; then
            print_status "Creating production environment file from template..."
            cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts

            # Replace the placeholder with actual API key
            sed -i "s/YOUR_PRODUCTION_GOOGLE_PLACES_API_KEY_HERE/$GOOGLE_MAPS_API_KEY/g" src/environments/environment.prod.ts
            print_success "Environment file configured with API key"
        else
            print_warning "environment.prod.example.ts not found, skipping API key replacement"
        fi
    fi

    # Build Web
    print_status "Running Web build command: $WEB_BUILD_COMMAND"
    eval "$WEB_BUILD_COMMAND"

    # Clean up temporary environment file
    if [ -f "src/environments/environment.prod.ts" ]; then
        print_status "Cleaning up temporary environment file..."
        rm -f src/environments/environment.prod.ts
    fi

    if [ ! -d "dist-prod" ]; then
        print_error "Web build failed - dist directory not found"
        exit 1
    fi

    print_success "Web build completed"
    end_phase "Build: Web"
fi

# Build Spindly.app (landing page)
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping Spindly build (--skip-build flag specified)"
    cd "$SCRIPT_DIR/src_new/spindly.app"
    if [ ! -d "dist/spindly-web/browser" ]; then
        print_error "Spindly dist/spindly-web/browser directory not found and build was skipped. Please build first or run without --skip-build"
        exit 1
    fi
    end_phase "Build: Spindly (skipped)"
else
    print_status "Building Spindly.app (landing page)..."
    cd "$SCRIPT_DIR/src_new/spindly.app"

    if [ ! -f "package.json" ]; then
        print_error "package.json not found in Spindly directory"
        exit 1
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing Spindly dependencies..."
        npm install
    fi

    # Set up production environment file
    if [ -f "src/environments/environment.prod.example.ts" ]; then
        print_status "Creating Spindly production environment file..."
        cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
    else
        print_warning "environment.prod.example.ts not found, skipping environment setup"
    fi

    # Build Spindly
    print_status "Running Spindly build command: $SPINDLY_BUILD_COMMAND"
    eval "$SPINDLY_BUILD_COMMAND"

    # Clean up temporary environment file
    if [ -f "src/environments/environment.prod.ts" ]; then
        rm -f src/environments/environment.prod.ts
    fi

    if [ ! -d "dist/spindly-web/browser" ]; then
        print_error "Spindly build failed - dist/spindly-web/browser directory not found"
        exit 1
    fi

    print_success "Spindly build completed"
    end_phase "Build: Spindly"
fi

# Build Ticketing App
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping Ticketing App build (--skip-build flag specified)"
    cd "$SCRIPT_DIR/src_new/ticketing-app"
    if [ ! -d "dist/ticketing-app/browser" ]; then
        print_error "Ticketing App dist/ticketing-app/browser directory not found and build was skipped. Please build first or run without --skip-build"
        exit 1
    fi
    end_phase "Build: Ticketing App (skipped)"
else
    print_status "Building Ticketing App..."
    cd "$SCRIPT_DIR/src_new/ticketing-app"

    if [ ! -f "package.json" ]; then
        print_error "package.json not found in Ticketing App directory"
        exit 1
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing Ticketing App dependencies..."
        npm install
    fi

    # Handle environment configuration for Ticketing App
    print_status "Configuring Ticketing App production environment..."

    if [ -f "src/environments/environment.prod.example.ts" ]; then
        print_status "Creating Ticketing App production environment file from template..."
        cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts

        TICKETING_MAPS_KEY=""
        if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
            TICKETING_MAPS_KEY="$GOOGLE_MAPS_API_KEY"
        elif [ -n "$GOOGLE_MAPS_API_KEY_CONFIG" ]; then
            TICKETING_MAPS_KEY="$GOOGLE_MAPS_API_KEY_CONFIG"
        fi

        if [ -n "$TICKETING_MAPS_KEY" ]; then
            sed -i "s/YOUR_PRODUCTION_GOOGLE_MAPS_API_KEY_HERE/$TICKETING_MAPS_KEY/g" src/environments/environment.prod.ts
        else
            print_warning "No Google Maps API key found — googleMapsApiKey placeholder left as-is"
        fi

        if [ -n "$TICKETING_APP_PUBLIC_LISTING_DOMAIN" ]; then
            sed -i "s/YOUR_PUBLIC_LISTING_DOMAIN_HERE/$TICKETING_APP_PUBLIC_LISTING_DOMAIN/g" src/environments/environment.prod.ts
        else
            print_warning "TICKETING_APP_PUBLIC_LISTING_DOMAIN not set in deploy.config — placeholder left as-is"
        fi
    else
        print_warning "environment.prod.example.ts not found in Ticketing App, skipping environment setup"
    fi

    # Build Ticketing App
    print_status "Running Ticketing App build command: $TICKETING_BUILD_COMMAND"
    eval "$TICKETING_BUILD_COMMAND"

    # Clean up temporary environment file
    if [ -f "src/environments/environment.prod.ts" ]; then
        print_status "Cleaning up Ticketing App temporary environment file..."
        rm -f src/environments/environment.prod.ts
    fi

    if [ ! -d "dist/ticketing-app/browser" ]; then
        print_error "Ticketing App build failed - dist/ticketing-app/browser directory not found"
        exit 1
    fi

    print_success "Ticketing App build completed"
    end_phase "Build: Ticketing App"
fi

# Function to clean directory on server
clean_directory() {
    local target_dir=$1
    local description=$2
    
    print_status "Cleaning $description directory: $target_dir"
    
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
        if [ -d "$target_dir" ]; then
            echo "Removing all files from $target_dir..."
            rm -rf $target_dir/*
        else
            echo "Creating directory $target_dir..."
            mkdir -p $target_dir
        fi
EOF
    
    if [ $? -eq 0 ]; then
        print_success "$description directory cleaned successfully"
    else
        print_error "Failed to clean $description directory"
        exit 1
    fi
}

# Function to upload files via tar piped over SSH (faster than SFTP for many files)
# Compresses locally and streams over a single SSH connection
upload_files() {
    local source_dir=$1
    local target_dir=$2
    local description=$3

    print_status "Uploading $description to $target_dir..."

    if tar czf - -C "$source_dir" . | \
        ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
            "$SFTP_USER@$PRODUCTION_HOST" "tar xzf - -C $target_dir"; then
        print_success "$description uploaded successfully"
    else
        print_error "Failed to upload $description"
        exit 1
    fi
}

# Both checks must happen BEFORE clean_directory wipes the server state
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

# Clean server directories before upload
start_phase
# Backend: exclude node_modules from the wipe so it can be reused when dependencies haven't changed
print_status "Cleaning API server directory (preserving node_modules)..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" \
    "find $BACKEND_DEPLOY_PATH -maxdepth 1 -mindepth 1 ! -name 'node_modules' ! -name '.*' -exec rm -rf {} + 2>/dev/null; mkdir -p $BACKEND_DEPLOY_PATH"
print_success "API server directory cleaned"
clean_directory "$FRONTEND_DEPLOY_PATH" "Web server"
clean_directory "$SPINDLY_DEPLOY_PATH" "Spindly server"
clean_directory "$TICKETING_APP_DEPLOY_PATH" "Ticketing App server"

# Deploy maintenance page and .htaccess after cleaning
print_status "Deploying maintenance mode..."
cd "$SCRIPT_DIR"
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

if [ "$RUN_MIGRATIONS" = true ]; then
    # Phase 1: Upload migration setup with config.js for Sequelize CLI
    start_phase
    cd "$SCRIPT_DIR/src_new/label-dashboard-api"
    print_status "Phase 1: Uploading migration setup..."
    tar czf - package.json package-lock.json .sequelizerc config migrations | \
        ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no \
            "$SFTP_USER@$PRODUCTION_HOST" "cd $BACKEND_DEPLOY_PATH && tar xzf -"
    end_phase "Phase 1: Upload migration setup"

    # Phase 2: Run database migrations on server using Sequelize CLI
    start_phase
    print_status "Phase 2: Running database migrations on server..."
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
        echo "Navigating to API directory for migrations..."
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

    if [ $? -ne 0 ]; then
        print_error "Database migrations failed"
        exit 1
    fi

    print_success "Database migrations completed successfully"
    end_phase "Phase 2: Database migrations"

    # Phase 3: Remove config.js to avoid conflicts with compiled API
    start_phase
    print_status "Phase 3: Removing config.js to avoid conflicts..."
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
        echo "Removing config.js to prevent conflicts with compiled API..."
        rm -f $BACKEND_DEPLOY_PATH/config/config.js
        rm -f $BACKEND_DEPLOY_PATH/config/database.js
EOF

    print_success "Conflicting config files removed"
    end_phase "Phase 3: Config conflicts resolved"
else
    # Migrations skipped — but still need package.json on server to run npm install
    start_phase
    print_status "Phases 1-3: Skipping migrations — uploading package files and migrations folder..."
    cd "$SCRIPT_DIR/src_new/label-dashboard-api"
    # package.json + package-lock.json: needed for npm install below
    # migrations/: not needed by npm, but must be present on the server so the
    #              next deploy's auto-detection can compare filenames correctly
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

# Phase 4: Upload compiled API service files
start_phase
print_status "Phase 4: Uploading compiled API service files..."
upload_files "$SCRIPT_DIR/src_new/label-dashboard-api/dist" "$BACKEND_DEPLOY_PATH" "API dist files"
end_phase "Phase 4: Upload API dist files"

# Phase 5: Restart PM2 application with compiled API
start_phase
print_status "Phase 5: Restarting PM2 application: $PM2_APP_NAME"

ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
    echo "Navigating to API directory..."
    cd $BACKEND_DEPLOY_PATH

    echo "Restarting PM2 application: $PM2_APP_NAME"
    pm2 restart $PM2_APP_NAME || pm2 start app.js --name $PM2_APP_NAME

    echo "Checking PM2 status..."
    pm2 status
EOF

if [ $? -ne 0 ]; then
    print_error "Failed to restart PM2 application in Phase 5"
    exit 1
fi

print_success "✅ Phase 5: PM2 application '$PM2_APP_NAME' restarted successfully"
end_phase "Phase 5: PM2 restart"

# Phase 6: Upload Web files (keeping maintenance.html)
start_phase
print_status "Phase 6: Deploying frontend application..."
cd "$SCRIPT_DIR/src_new/label-dashboard-web"

# Upload all files except .htaccess first via tar (preserves maintenance mode during transfer)
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
print_success "✅ Phase 6: Frontend application deployed and live!"
end_phase "Phase 6: Deploy frontend"

# Phase 7: Deploy Spindly.app (landing page)
start_phase
print_status "Phase 7: Deploying Spindly.app landing page..."
upload_files "$SCRIPT_DIR/src_new/spindly.app/dist/spindly-web/browser" "$SPINDLY_DEPLOY_PATH" "Spindly landing page"
print_success "✅ Phase 7: Spindly.app deployed and live!"
end_phase "Phase 7: Deploy Spindly"

# Phase 8: Deploy Ticketing App
start_phase
print_status "Phase 8: Deploying Ticketing App..."

# Substitute API URL placeholder in .htaccess for social media crawler SEO redirects
HTACCESS_PATH="$SCRIPT_DIR/src_new/ticketing-app/dist/ticketing-app/browser/.htaccess"
if [ -f "$HTACCESS_PATH" ]; then
    if [ -n "$TICKETING_API_URL" ]; then
        sed -i "s|YOUR_API_URL_HERE|$TICKETING_API_URL|g" "$HTACCESS_PATH"
        print_status "Ticketing app .htaccess: substituted API URL for SEO crawler rules"
    else
        print_warning "TICKETING_API_URL not set in deploy.config — SEO crawler redirects in .htaccess will be broken"
    fi
fi

upload_files "$SCRIPT_DIR/src_new/ticketing-app/dist/ticketing-app/browser" "$TICKETING_APP_DEPLOY_PATH" "Ticketing App"
print_success "✅ Phase 8: Ticketing App deployed and live!"
end_phase "Phase 8: Deploy Ticketing App"

# Phase 9: Final deployment tasks
start_phase
print_status "Phase 9: Completing final deployment tasks..."

# Upload tmp folder if it exists
if [ -d "tmp" ]; then
    print_status "Uploading tmp folder..."
    sftp_batch=$(mktemp)
    cat > "$sftp_batch" << EOF
-mkdir $FRONTEND_DEPLOY_PATH/tmp
put -r tmp/* $FRONTEND_DEPLOY_PATH/tmp/
quit
EOF
    
    if sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"; then
        print_success "tmp folder uploaded successfully"
    else
        print_warning "Failed to upload tmp folder (non-critical)"
    fi
    rm -f "$sftp_batch"
else
    print_status "No tmp folder found, skipping upload"
fi

# Clean up maintenance.html after successful deployment
print_status "Cleaning up maintenance files..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
    rm -f $FRONTEND_DEPLOY_PATH/maintenance.html
EOF
print_success "Maintenance files cleaned up"

# Upload SSL domain management scripts
print_status "Uploading SSL domain management scripts..."
cd "$SCRIPT_DIR"
sftp_batch=$(mktemp)
cat > "$sftp_batch" << EOF
put scripts/add-ssl-domain.sh /home/bitnami/
put scripts/remove-ssl-domain.sh /home/bitnami/
quit
EOF

sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"
if [ $? -eq 0 ]; then
    print_success "SSL domain management scripts uploaded successfully"

    # Make the scripts executable and fix line endings
    print_status "Setting executable permissions and fixing line endings..."
    ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << 'EOSSH'
        # Process add-ssl-domain.sh
        chmod +x /home/bitnami/add-ssl-domain.sh
        if command -v dos2unix &> /dev/null; then
            dos2unix /home/bitnami/add-ssl-domain.sh 2>/dev/null || true
        elif command -v sed &> /dev/null; then
            sed -i 's/\r$//' /home/bitnami/add-ssl-domain.sh
        fi

        # Process remove-ssl-domain.sh
        chmod +x /home/bitnami/remove-ssl-domain.sh
        if command -v dos2unix &> /dev/null; then
            dos2unix /home/bitnami/remove-ssl-domain.sh 2>/dev/null || true
        elif command -v sed &> /dev/null; then
            sed -i 's/\r$//' /home/bitnami/remove-ssl-domain.sh
        fi

        echo "Script permissions set and line endings fixed for both scripts"
EOSSH

    if [ $? -eq 0 ]; then
        print_success "Scripts configured successfully"
    else
        print_warning "Failed to set script permissions (non-critical)"
    fi
else
    print_warning "Failed to upload SSL domain management scripts (non-critical)"
fi
rm -f "$sftp_batch"

print_success "✅ Phase 9: Final deployment tasks completed"
end_phase "Phase 9: Final tasks"

# Final deployment summary
DEPLOY_TOTAL=$(( $(date +%s) - DEPLOY_START ))
echo ""
print_success "🎉 Deployment completed in $(format_duration $DEPLOY_TOTAL)"
echo ""
for i in "${!PHASE_NAMES[@]}"; do
    print_success "  ✅ ${PHASE_NAMES[$i]} — $(format_duration ${PHASE_DURATIONS[$i]})"
done
echo ""
print_status "Total deployment time: $(format_duration $DEPLOY_TOTAL)"
