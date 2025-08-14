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

# Function to check if domain already exists in lego command
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
    
    # Get current lego command from SSL wrapper script
    local wrapper_script="/tmp/ssl-renew-wrapper.sh"
    print_info "Reading lego command from SSL wrapper script..."
    
    if [[ ! -f "$wrapper_script" ]]; then
        print_error "SSL wrapper script not found at: $wrapper_script"
        print_error "Please ensure the SSL wrapper script exists."
        exit 1
    fi
    
    # Find the letsencrypt line in the wrapper script
    local letsencrypt_line
    letsencrypt_line=$(grep -E "lego.*--domains.*renew.*bncert-autorenew" "$wrapper_script" | head -n 1)
    
    if [[ -z "$letsencrypt_line" ]]; then
        print_error "No letsencrypt command found in wrapper script."
        print_error "Please ensure the wrapper script contains a valid lego command."
        exit 1
    fi
    
    print_info "Found letsencrypt command in wrapper script"
    
    # Check if domain already exists
    if check_domain_exists "$new_domain" "$letsencrypt_line"; then
        print_warning "Domain '$new_domain' already exists in the SSL renewal command"
        print_info "Current letsencrypt command:"
        echo "$letsencrypt_line"
        exit 0
    fi
    
    
    # Extract the existing domains and add the new one
    print_info "Adding domain '$new_domain' to the SSL renewal command..."
    
    # Create new command line with additional domain at the end
    local new_lego_line
    new_lego_line=$(echo "$letsencrypt_line" | sed "s/\(--domains=[^[:space:]]*\)/\1 --domains=$new_domain/")
    
    # Test the lego command first before updating wrapper script
    print_info "Testing lego command with new domain..."
    
    # Extract just the command part (the lego command without any cron schedule)
    local command_part
    command_part="$new_lego_line"
    
    # Add --days 999 flag for testing to force certificate generation
    local test_command_part
    test_command_part=$(echo "$command_part" | sed 's/ renew / renew --days 999 /')
    
    print_info "Testing command (with --days 999): $test_command_part"
    echo
    
    # Execute the lego command as a test
    if eval "$test_command_part"; then
        print_info "Lego command executed successfully!"
        print_info "Proceeding to update wrapper script..."
    else
        print_error "Lego command failed! Domain '$new_domain' may not be properly configured or accessible."
        print_error "Wrapper script will NOT be updated to prevent future failures."
        print_warning "Please verify that:"
        print_warning "  1. The domain '$new_domain' is correctly pointed to this server"
        print_warning "  2. Port 80/443 are accessible for domain validation"
        print_warning "  3. No firewall is blocking Let's Encrypt validation"
        exit 1
    fi
    
    # Update the existing wrapper script with the new command
    print_info "Updating wrapper script at $wrapper_script"
    
    # Create backup of the wrapper script
    local wrapper_backup="${wrapper_script}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$wrapper_script" "$wrapper_backup"
    print_info "Wrapper script backed up to: $wrapper_backup"
    
    # Update the wrapper script with the new command
    cat > "$wrapper_script" << EOF
#!/bin/bash
$command_part
EOF
    
    chmod +x "$wrapper_script"
    
    print_info "Wrapper script updated successfully"
    
    # Display the updated wrapper script contents
    print_info "Updated letsencrypt command in wrapper script:"
    echo "$command_part"
    print_info "Wrapper script location: $wrapper_script"
    
    print_info "Domain management completed successfully!"
}

# Run main function with all arguments
main "$@"