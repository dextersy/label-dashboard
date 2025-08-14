#!/bin/bash

# Label Dashboard Deployment Script
# This script builds and deploys both the API and Web applications to production

set -e  # Exit on any error

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
if [ -z "$SFTP_KEY_PATH" ] || [ -z "$PRODUCTION_HOST" ] || [ -z "$SFTP_USER" ] || [ -z "$BACKEND_DEPLOY_PATH" ] || [ -z "$FRONTEND_DEPLOY_PATH" ]; then
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
PM2_APP_NAME=${PM2_APP_NAME:-"app"}

print_status "Starting deployment process..."
print_status "Target server: $SFTP_USER@$PRODUCTION_HOST"
print_status "Backend path: $BACKEND_DEPLOY_PATH"
print_status "Frontend path: $FRONTEND_DEPLOY_PATH"

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

# Build API
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

# Build Web
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

# Build Web
print_status "Running Web build command: $WEB_BUILD_COMMAND"
eval "$WEB_BUILD_COMMAND"

if [ ! -d "dist-prod" ]; then
    print_error "Web build failed - dist directory not found"
    exit 1
fi

print_success "Web build completed"

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

# Function to upload files via SFTP
upload_files() {
    local source_dir=$1
    local target_dir=$2
    local description=$3
    
    print_status "Uploading $description to $target_dir..."
    
    # Create SFTP batch file
    local sftp_batch=$(mktemp)
    
    # SFTP commands
    cat > "$sftp_batch" << EOF
-mkdir $target_dir
put -r $source_dir/* $target_dir/
quit
EOF
    
    # Execute SFTP upload
    if sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"; then
        print_success "$description uploaded successfully"
    else
        print_error "Failed to upload $description"
        rm -f "$sftp_batch"
        exit 1
    fi
    
    # Clean up
    rm -f "$sftp_batch"
}

# Clean server directories before upload
clean_directory "$BACKEND_DEPLOY_PATH" "API server"
clean_directory "$FRONTEND_DEPLOY_PATH" "Web server"

# Phase 1: Upload migration setup with config.js for Sequelize CLI
cd "$SCRIPT_DIR/src_new/label-dashboard-api"
print_status "Phase 1: Uploading migration setup..."
sftp_batch=$(mktemp)
cat > "$sftp_batch" << EOF
put package.json $BACKEND_DEPLOY_PATH/
put package-lock.json $BACKEND_DEPLOY_PATH/
put .sequelizerc $BACKEND_DEPLOY_PATH/
-mkdir $BACKEND_DEPLOY_PATH/config
put -r config/* $BACKEND_DEPLOY_PATH/config/
-mkdir $BACKEND_DEPLOY_PATH/migrations
put -r migrations/* $BACKEND_DEPLOY_PATH/migrations/
quit
EOF

sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"
rm -f "$sftp_batch"

# Phase 2: Run database migrations on server using Sequelize CLI
print_status "Phase 2: Running database migrations on server..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
    echo "Navigating to API directory for migrations..."
    cd $BACKEND_DEPLOY_PATH
    
    echo "Installing dependencies for migrations..."
    npm install --production
    
    echo "Running database migrations..."
    NODE_ENV=production npx sequelize-cli db:migrate
EOF

if [ $? -ne 0 ]; then
    print_error "Database migrations failed"
    exit 1
fi

print_success "Database migrations completed successfully"

# Phase 3: Remove config.js to avoid conflicts with compiled API
print_status "Phase 3: Removing config.js to avoid conflicts..."
ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
    echo "Removing config.js to prevent conflicts with compiled API..."
    rm -f $BACKEND_DEPLOY_PATH/config/config.js
    rm -f $BACKEND_DEPLOY_PATH/config/database.js
EOF

print_success "Conflicting config files removed"

# Phase 4: Upload compiled API service files
print_status "Phase 4: Uploading compiled API service files..."
upload_files "dist" "$BACKEND_DEPLOY_PATH" "API dist files"

# Upload Web files
cd "$SCRIPT_DIR/src_new/label-dashboard-web"
upload_files "dist-prod/browser" "$FRONTEND_DEPLOY_PATH" "Web files"

# Upload .htaccess file separately (hidden files are not included in regular upload)
print_status "Uploading .htaccess file..."
sftp_batch=$(mktemp)
cat > "$sftp_batch" << EOF
put dist-prod/browser/.htaccess $FRONTEND_DEPLOY_PATH/
quit
EOF

sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"
rm -f "$sftp_batch"
print_success ".htaccess file uploaded successfully"

# Upload SSL domain management script
print_status "Uploading add-ssl-domain.sh script..."
cd "$SCRIPT_DIR"
sftp_batch=$(mktemp)
cat > "$sftp_batch" << EOF
put scripts/add-ssl-domain.sh /home/bitnami/
quit
EOF

sftp -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no -b "$sftp_batch" "$SFTP_USER@$PRODUCTION_HOST"
if [ $? -eq 0 ]; then
    print_success "add-ssl-domain.sh script uploaded successfully"
else
    print_warning "Failed to upload add-ssl-domain.sh script (non-critical)"
fi
rm -f "$sftp_batch"

# Phase 5: Restart PM2 application with compiled API
print_status "Phase 5: Restarting PM2 application: $PM2_APP_NAME"

ssh -i "$SFTP_KEY_PATH" -o StrictHostKeyChecking=no "$SFTP_USER@$PRODUCTION_HOST" << EOF
    echo "Navigating to API directory..."
    cd $BACKEND_DEPLOY_PATH
    
    echo "Restarting PM2 application: $PM2_APP_NAME"
    pm2 restart $PM2_APP_NAME || pm2 start app.js --name $PM2_APP_NAME
    
    echo "Checking PM2 status..."
    pm2 status
EOF

if [ $? -eq 0 ]; then
    print_success "🎉 5-Phase Deployment completed successfully!"
    print_success "✅ Phase 1: Migration setup uploaded"
    print_success "✅ Phase 2: Database migrations executed"
    print_success "✅ Phase 3: Config conflicts resolved"
    print_success "✅ Phase 4: API service deployed to $BACKEND_DEPLOY_PATH"
    print_success "✅ Phase 5: PM2 application '$PM2_APP_NAME' restarted"
    print_success "Web deployed to: $FRONTEND_DEPLOY_PATH"
else
    print_error "Failed to restart PM2 application in Phase 5"
    exit 1
fi

print_status "Deployment finished!"
