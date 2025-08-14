# SSL Certificate Management

This document describes the automatic SSL certificate management feature for sublabel domain creation.

## Overview

When a new sublabel is created with a `melt-records.com` subdomain, the system automatically:

1. Creates the DNS A record using AWS Lightsail
2. Adds the domain to the SSL certificate by SSH-ing to the frontend server
3. Runs the `add-ssl-domain.sh` script with the `--days 999` flag

**Important**: SSL certificate updates only occur during sublabel creation with Lightsail DNS configuration. Manual domain additions do NOT trigger SSL updates.

## Environment Variables

The following environment variables must be configured in your `.env` file:

```env
# Frontend server configuration for SSL management
FRONTEND_IP=xxx.xxx.xxx.xxx          # IP address of the frontend server
SSH_KEY_PATH=/path/to/ssh/private/key # Path to SSH private key (required)
SSH_USER=ssh_username                # SSH username (required)

# Existing variables (required for domain validation)
LIGHTSAIL_DOMAIN=melt-records.com     # Base domain for subdomains
```

## How It Works

### 1. Sublabel Creation Process

When `POST /api/brand/:brandId/sublabel` is called with a `subdomain_name`:

```javascript
{
  "brand_name": "New Sublabel",
  "subdomain_name": "newsublabel"
}
```

The system will:
- Create DNS A record for `newsublabel.melt-records.com`
- Add the domain to the SSL certificate automatically
- Return status including SSL configuration result

### 2. Manual Domain Addition

When `POST /api/brand/:brandId/domains` is called:

```javascript
{
  "domain_name": "anothersublabel.melt-records.com"
}
```

The system will create the domain record but will NOT automatically configure SSL. Manual SSL configuration is required for these domains.

### 3. SSL Script Execution

The backend executes this SSH command:

```bash
ssh -i SSH_KEY_PATH SSH_USER@FRONTEND_IP ./add-ssl-domain.sh DOMAIN_NAME
```

## Response Format

The API responses now include SSL configuration status:

```json
{
  "message": "Sublabel created successfully with automatic DNS and SSL configuration",
  "sublabel": {
    "id": 123,
    "brand_name": "New Sublabel",
    "domain_name": "newsublabel.melt-records.com",
    "domain_status": "Verified",
    "admin_user_id": 456,
    "dns_configured": true,
    "ssl_configured": true,
    "ssl_message": "SSL certificate updated successfully for domain newsublabel.melt-records.com"
  }
}
```

## Error Handling

### SSL Operation Failures

SSL operations are designed to be non-blocking:
- If SSL configuration fails, the sublabel creation still succeeds
- Error details are logged and returned in the `ssl_message` field
- Manual SSL configuration can be performed later if needed

### Common Issues

1. **SSH Connection Failed**
   - Check `FRONTEND_IP` environment variable
   - Verify SSH key path and permissions
   - Ensure frontend server is accessible

2. **Script Not Found**
   - Verify `add-ssl-domain.sh` exists in `/home/bitnami/` on frontend server
   - Check script permissions (should be executable)

3. **Domain Already Exists**
   - The script will detect and skip duplicate domains
   - Check existing cron job for domain presence

## Logging

SSL operations are logged with the `[SSL]` prefix:

```
[SSL] 2025-08-13T02:26:27.587Z - SUCCESS - Domain: test.melt-records.com - SSL certificate updated successfully
[SSL] 2025-08-13T02:26:27.587Z - FAILED - Domain: invalid.melt-records.com - SSH connection failed
```

## Security Considerations

1. **SSH Key Security**
   - Use dedicated SSH key with minimal permissions
   - Restrict SSH access to specific IP ranges if possible
   - Regularly rotate SSH keys

2. **Network Security**
   - Ensure secure connection between backend and frontend servers
   - Use VPC or private networks when possible

3. **Script Security**
   - The `add-ssl-domain.sh` script validates domain formats
   - Only melt-records.com subdomains are automatically processed
   - Script includes safety checks and backups

## Manual Operations

If automatic SSL configuration fails, you can manually add domains:

```bash
# SSH to frontend server
ssh -i SSH_KEY_PATH SSH_USER@FRONTEND_IP

# Add domain manually
./add-ssl-domain.sh newdomain.melt-records.com
```

## Monitoring

Monitor SSL operations through:
- Application logs (`[SSL]` prefix)
- Frontend server logs
- SSL certificate status via browser or SSL checker tools