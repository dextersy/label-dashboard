#!/bin/bash

# SSL Domain Management Script
# This script adds a new domain to the existing letsencrypt cron job and runs the certificate renewal

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to validate domain name
validate_domain() {
    local domain="$1"
    
    # Basic domain validation regex
    if [[ ! $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        print_error "Invalid domain format: $domain"
        exit 1
    fi
    
    # Check if domain is too long (253 characters max)
    if [[ ${#domain} -gt 253 ]]; then
        print_error "Domain name too long: $domain"
        exit 1
    fi
}

# Function to check if domain already exists in crontab
check_domain_exists() {
    local domain="$1"
    local current_cron="$2"
    
    if echo "$current_cron" | grep -q "domains=$domain\b\|domains=[^[:space:]]*,$domain,\|domains=[^[:space:]]*,$domain\s"; then
        return 0  # Domain exists
    else
        return 1  # Domain doesn't exist
    fi
}

# Function to backup crontab
backup_crontab() {
    local backup_file="/tmp/crontab_backup_$(date +%Y%m%d_%H%M%S)"
    crontab -l > "$backup_file" 2>/dev/null || true
    print_info "Crontab backed up to: $backup_file"
    echo "$backup_file"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] <domain-name>"
    echo
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo
    echo "Examples:"
    echo "  $0 newdomain.melt-records.com"
    echo
    echo "Note: This script will automatically test the SSL certificate generation"
    echo "      before adding the domain to the cron job to ensure it works properly."
}

# Main function
main() {
    local new_domain=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$new_domain" ]]; then
                    new_domain="$1"
                else
                    print_error "Multiple domain names provided. Please specify only one domain."
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Check if domain argument is provided
    if [[ -z "$new_domain" ]]; then
        print_error "Domain name is required"
        show_usage
        exit 1
    fi
    
    print_info "Starting SSL domain management for: $new_domain"
    
    # Validate domain format
    validate_domain "$new_domain"
    
    # Get current crontab
    print_info "Reading current crontab..."
    local current_cron
    current_cron=$(crontab -l 2>/dev/null) || {
        print_error "Failed to read crontab or crontab is empty"
        exit 1
    }
    
    # Find the letsencrypt line
    local letsencrypt_line
    letsencrypt_line=$(echo "$current_cron" | grep -E "lego.*--domains.*renew.*bncert-autorenew" | head -n 1)
    
    if [[ -z "$letsencrypt_line" ]]; then
        print_error "No letsencrypt cron job found. Please ensure the letsencrypt cron job exists."
        exit 1
    fi
    
    print_info "Found letsencrypt cron job"
    
    # Check if domain already exists
    if check_domain_exists "$new_domain" "$letsencrypt_line"; then
        print_warning "Domain '$new_domain' already exists in the cron job"
        print_info "Current letsencrypt command:"
        echo "$letsencrypt_line"
        exit 0
    fi
    
    # Backup current crontab
    local backup_file
    backup_file=$(backup_crontab)
    
    # Extract the existing domains and add the new one
    print_info "Adding domain '$new_domain' to the cron job..."
    
    # Create new cron line with additional domain at the end
    local new_cron_line
    new_cron_line=$(echo "$letsencrypt_line" | sed "s/\(--domains=[^[:space:]]*\)/\1 --domains=$new_domain/")
    
    # Test the lego command first before updating crontab
    print_info "Testing lego command with new domain..."
    
    # Extract just the command part (everything after the schedule)
    local command_part
    command_part=$(echo "$new_cron_line" | sed 's/^[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*//')
    
    # Add --days 999 flag for testing to force certificate generation
    local test_command_part
    test_command_part=$(echo "$command_part" | sed 's/ renew / renew --days 999 /')
    
    print_info "Testing command (with --days 999): $test_command_part"
    echo
    
    # Execute the lego command as a test
    if eval "$test_command_part"; then
        print_info "Lego command executed successfully!"
        print_info "Proceeding to update crontab..."
    else
        print_error "Lego command failed! Domain '$new_domain' may not be properly configured or accessible."
        print_error "Crontab will NOT be updated to prevent future failures."
        print_warning "Please verify that:"
        print_warning "  1. The domain '$new_domain' is correctly pointed to this server"
        print_warning "  2. Port 80/443 are accessible for domain validation"
        print_warning "  3. No firewall is blocking Let's Encrypt validation"
        exit 1
    fi
    
    # Create a wrapper script to avoid crontab command length limits
    local wrapper_script="/tmp/ssl-renew-wrapper.sh"
    print_info "Creating wrapper script at $wrapper_script"
    
    # Extract just the command part for the wrapper script
    cat > "$wrapper_script" << EOF
#!/bin/bash
$command_part
EOF
    
    chmod +x "$wrapper_script"
    
    # Create new cron line that calls the wrapper script instead of the long command
    local schedule_part
    schedule_part=$(echo "$letsencrypt_line" | sed 's/^\([^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*[^[:space:]]*[[:space:]]*\).*/\1/')
    local wrapper_cron_line="${schedule_part}${wrapper_script} # bncert-autorenew"
    
    # Replace the old line with the new wrapper-based cron line
    local new_crontab
    new_crontab=$(echo "$current_cron" | sed "s|$(echo "$letsencrypt_line" | sed 's/[[\.*^$()+?{|]/\\&/g')|$wrapper_cron_line|")
    
    # Install the new crontab
    print_info "Updating crontab..."
    echo "$new_crontab" | crontab -
    
    if [[ $? -eq 0 ]]; then
        print_info "Crontab updated successfully"
    else
        print_error "Failed to update crontab. Restoring from backup..."
        cat "$backup_file" | crontab -
        exit 1
    fi
    
    # Display the updated cron job
    print_info "Updated letsencrypt cron job:"
    echo "$wrapper_cron_line"
    print_info "Wrapper script created at: $wrapper_script"
    print_info "Wrapper script contains:"
    echo "$command_part"
    
    print_info "Domain management completed successfully!"
}

# Run main function with all arguments
main "$@"