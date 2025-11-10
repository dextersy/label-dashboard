#!/bin/bash

# SSL Domain Removal Script
# This script removes a domain from the existing letsencrypt renewal command
# Uses a fixed certificate name (melt-records-dashboard) to ensure consistent cert management
# regardless of domain order

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

# Function to check if domain exists in lego command
check_domain_exists() {
    local domain="$1"
    local current_cron="$2"

    if echo "$current_cron" | grep -q -- "--domains=$domain\b"; then
        return 0  # Domain exists
    else
        return 1  # Domain doesn't exist
    fi
}

# Function to count domains in lego command
count_domains() {
    local lego_line="$1"
    echo "$lego_line" | grep -o -- "--domains=" | wc -l
}

# Function to backup wrapper script
backup_wrapper() {
    local wrapper_script="$1"
    local backup_file="${wrapper_script}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$wrapper_script" "$backup_file" 2>/dev/null || true
    print_info "Wrapper script backed up to: $backup_file"
    echo "$backup_file"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] <domain-name>"
    echo
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -f, --force         Force removal even if it's the last domain (WARNING: Will break SSL)"
    echo "  --no-renew          Skip SSL renewal/testing (just update the renewal script)"
    echo
    echo "Examples:"
    echo "  $0 olddomain.melt-records.com"
    echo "  $0 --no-renew olddomain.melt-records.com"
    echo "  $0 --force lastdomain.com"
    echo
    echo "Note: By default, this script tests the SSL certificate generation"
    echo "      after removing the domain. Use --no-renew to skip this step."
    echo
    echo "Certificate Management:"
    echo "  The script uses a fixed certificate name (melt-records-dashboard)"
    echo "  to ensure consistent certificate management regardless of domain order."
}

# Main function
main() {
    local remove_domain=""
    local force_removal=false
    local skip_renew=false

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -f|--force)
                force_removal=true
                shift
                ;;
            --no-renew)
                skip_renew=true
                shift
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$remove_domain" ]]; then
                    remove_domain="$1"
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
    if [[ -z "$remove_domain" ]]; then
        print_error "Domain name is required"
        show_usage
        exit 1
    fi

    print_info "Starting SSL domain removal for: $remove_domain"

    # Validate domain format
    validate_domain "$remove_domain"

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
    letsencrypt_line=$(grep -E "lego.*--domains.*renew" "$wrapper_script" | head -n 1)

    if [[ -z "$letsencrypt_line" ]]; then
        print_error "No letsencrypt command found in wrapper script."
        print_error "Please ensure the wrapper script contains a valid lego command."
        exit 1
    fi

    print_info "Found letsencrypt command in wrapper script"

    # Check if domain exists
    if ! check_domain_exists "$remove_domain" "$letsencrypt_line"; then
        print_warning "Domain '$remove_domain' does not exist in the SSL renewal command"
        print_info "Current letsencrypt command:"
        echo "$letsencrypt_line"
        exit 0
    fi

    # Count total domains
    local total_domains
    total_domains=$(count_domains "$letsencrypt_line")

    print_info "Total domains in certificate: $total_domains"

    # Check if this is the last domain
    if [[ $total_domains -eq 1 ]]; then
        if [[ "$force_removal" == false ]]; then
            print_error "Cannot remove the last domain from SSL certificate!"
            print_error "This would leave no domains in the certificate and break SSL entirely."
            print_error "If you really want to do this, use the --force flag."
            print_warning "WARNING: Forcing removal of the last domain will break SSL for the entire system!"
            exit 1
        else
            print_warning "⚠️  FORCING removal of the last domain - SSL will be broken after this!"
        fi
    fi

    # Remove the domain from the command
    print_info "Removing domain '$remove_domain' from the SSL renewal command..."

    # Remove the specific --domains flag for this domain
    # This handles the domain regardless of its position in the command
    local new_lego_line
    new_lego_line=$(echo "$letsencrypt_line" | sed "s/ --domains=$remove_domain\b//g")

    # Verify that the domain was actually removed
    if [[ "$new_lego_line" == "$letsencrypt_line" ]]; then
        print_error "Failed to remove domain from command. No changes made."
        exit 1
    fi

    print_info "Domain removed from command"

    # Extract the command part for wrapper script update
    local command_part
    command_part="$new_lego_line"

    # Test the new SSL configuration unless --no-renew is specified
    if [[ "$skip_renew" == true ]]; then
        print_info "Skipping SSL renewal test (--no-renew flag specified)"
        print_info "The domain has been removed from the renewal script only"
        print_info "Current SSL certificate remains valid and unchanged"
    elif [[ $total_domains -gt 1 ]]; then
        # Test the lego command with remaining domains
        print_info "Testing lego command with remaining domains..."

        # Add --days 999 flag for testing to force certificate generation
        local test_command_part
        test_command_part=$(echo "$command_part" | sed 's/ renew / renew --days 999 /')

        print_info "Testing command (with --days 999): $test_command_part"
        echo

        # Execute the lego command as a test
        if eval "$test_command_part"; then
            print_info "Lego command executed successfully with remaining domains!"
            print_info "Proceeding to update wrapper script..."
        else
            print_error "Lego command failed! One or more remaining domains may not be accessible."
            print_error "Wrapper script will NOT be updated to prevent future failures."
            print_warning "Please verify that all remaining domains are correctly configured."
            exit 1
        fi
    else
        print_warning "Skipping lego test since this is the last domain (forced removal)"
    fi

    # Backup the wrapper script
    backup_wrapper "$wrapper_script"

    # Update the wrapper script with the new command
    print_info "Updating wrapper script at $wrapper_script"

    # Update the wrapper script with the new command (or empty if last domain removed)
    if [[ $total_domains -gt 1 ]]; then
        cat > "$wrapper_script" << EOF
#!/bin/bash
$command_part
EOF
    else
        # Last domain removed - create placeholder script
        cat > "$wrapper_script" << EOF
#!/bin/bash
# No domains configured - SSL renewal disabled
# Add domains using add-ssl-domain.sh before enabling renewal
echo "No domains configured for SSL renewal"
exit 0
EOF
    fi

    chmod +x "$wrapper_script"

    print_info "Wrapper script updated successfully"

    # Display the updated wrapper script contents
    if [[ $total_domains -gt 1 ]]; then
        print_info "Updated letsencrypt command in wrapper script:"
        echo "$command_part"
    else
        print_warning "SSL renewal has been disabled (no domains remaining)"
    fi

    print_info "Wrapper script location: $wrapper_script"
    print_info "Domain removal completed successfully!"
    print_info "Remaining domains: $((total_domains - 1))"
}

# Run main function with all arguments
main "$@"
