#!/bin/bash

# Lambda Jobs-only Deployment Script
# Packages and deploys all Lambda jobs in label-dashboard-jobs to AWS

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
            echo "  --skip-build  Skip the package step (use existing zip files)"
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

print_status "Starting Lambda jobs deployment..."

declare -a JOB_NAMES=()

# Package all jobs
start_phase
if [ "$SKIP_BUILD" = true ]; then
    print_warning "Skipping package step"
    for job_dir in "$SCRIPT_DIR"/*/; do
        job_name=$(basename "$job_dir")
        [ ! -f "$job_dir/${job_name}.zip" ] && \
            { print_error "Lambda job '$job_name' zip not found. Run 'npm run package' in $job_dir first or run without --skip-build"; exit 1; }
        JOB_NAMES+=("$job_name")
    done
    end_phase "Package: Lambda jobs (skipped)"
else
    print_status "Packaging all Lambda jobs in parallel..."
    BUILD_LOG_DIR=$(mktemp -d)
    declare -a JOB_PIDS=()

    for job_dir in "$SCRIPT_DIR"/*/; do
        job_name=$(basename "$job_dir")
        JOB_NAMES+=("$job_name")
        (
            cd "$job_dir"
            echo "[INFO] Packaging Lambda job: $job_name..."
            if [ ! -d "node_modules" ]; then
                echo "[INFO] Installing $job_name dependencies..."
                npm install
            fi
            npm run package
            zip_file="${job_name}.zip"
            [ ! -f "$zip_file" ] && { echo "[ERROR] $job_name package failed - $zip_file not found"; exit 1; }
            echo "[SUCCESS] $job_name packaged"
        ) > "$BUILD_LOG_DIR/job-${job_name}.log" 2>&1 &
        JOB_PIDS+=($!)
    done

    print_status "Waiting for all jobs to finish packaging..."
    declare -a JOB_EXIT_CODES=()
    for pid in "${JOB_PIDS[@]}"; do
        wait "$pid"; JOB_EXIT_CODES+=($?)
    done

    echo ""
    for job_name in "${JOB_NAMES[@]}"; do
        print_status "=== Lambda Job: $job_name Package Log ==="
        cat "$BUILD_LOG_DIR/job-${job_name}.log"
        echo ""
    done
    rm -rf "$BUILD_LOG_DIR"

    BUILD_ERRORS=0
    for i in "${!JOB_NAMES[@]}"; do
        [ "${JOB_EXIT_CODES[$i]}" -ne 0 ] && { print_error "Lambda job '${JOB_NAMES[$i]}' package failed"; BUILD_ERRORS=$((BUILD_ERRORS+1)); }
    done
    [ $BUILD_ERRORS -gt 0 ] && exit 1

    print_success "All Lambda jobs packaged successfully"
    end_phase "Package: Lambda jobs (parallel)"
fi

# Deploy all jobs
start_phase
print_status "Deploying Lambda jobs to AWS..."

LAMBDA_ERRORS=0
for job_name in "${JOB_NAMES[@]}"; do
    job_dir="$SCRIPT_DIR/$job_name"
    zip_file="$job_dir/${job_name}.zip"
    if [ ! -f "$zip_file" ]; then
        print_error "Lambda job '$job_name': zip file not found at $zip_file — skipping"
        LAMBDA_ERRORS=$((LAMBDA_ERRORS+1))
        continue
    fi

    print_status "Deploying Lambda job: $job_name..."

    deploy_script=$(cd "$job_dir" && node -e "const p=require('./package.json'); console.log(p.scripts.deploy || '')" 2>/dev/null)
    extra_flags=$(echo "$deploy_script" | grep -oP '(?<=aws lambda update-function-code ).*')

    if [ -z "$extra_flags" ]; then
        extra_flags="--function-name $job_name --zip-file fileb://${job_name}.zip"
    fi

    if (cd "$job_dir" && aws lambda update-function-code $extra_flags --no-cli-pager); then
        print_success "Lambda job '$job_name' deployed successfully"
    else
        print_error "Failed to deploy Lambda job '$job_name'"
        LAMBDA_ERRORS=$((LAMBDA_ERRORS+1))
    fi
done

[ $LAMBDA_ERRORS -gt 0 ] && { print_error "$LAMBDA_ERRORS Lambda job(s) failed to deploy"; exit 1; }

print_success "✅ All Lambda jobs deployed successfully"
end_phase "Deploy: Lambda jobs"

DEPLOY_TOTAL=$(( $(date +%s) - DEPLOY_START ))
echo ""
print_success "🎉 Lambda jobs deployment completed in $(format_duration $DEPLOY_TOTAL)"
echo ""
for i in "${!PHASE_NAMES[@]}"; do
    print_success "  ✅ ${PHASE_NAMES[$i]} — $(format_duration ${PHASE_DURATIONS[$i]})"
done
echo ""
print_status "Total deployment time: $(format_duration $DEPLOY_TOTAL)"
