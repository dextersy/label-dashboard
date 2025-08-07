# Apache Configuration for On-Demand SEO Pages

This document explains how to configure Apache to serve SEO-optimized pages to social media crawlers while serving your Angular app to regular users.

## 🎯 How It Works

1. **Regular Users**: Access `/public/events/123/buy-tickets` → Gets Angular app
2. **Social Crawlers**: Access `/public/events/123/buy-tickets` → Gets redirected to API-generated SEO page
3. **API Endpoint**: `http://your-api-server/api/public/seo/event-123.html` generates SEO HTML on-demand

## 🔧 Apache Configuration

### Method 1: Using .htaccess (Recommended)

Create or update your `.htaccess` file in your Angular app's document root:

```apache
RewriteEngine On

# Detect social media crawlers for ticket purchase pages
RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot) [NC]
RewriteRule ^public/events/([0-9]+)/buy-tickets$ http://your-api-server/api/public/seo/event-$1.html [R=302,L]

# Regular Angular routing (catch-all)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^.*$ /index.html [L]
```

### Method 2: Virtual Host Configuration

Add this to your Apache virtual host configuration:

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /path/to/your/angular/dist-prod
    
    # Enable mod_rewrite
    RewriteEngine On
    
    # SEO redirect for social media crawlers
    RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot) [NC]
    RewriteRule ^/public/events/([0-9]+)/buy-tickets$ http://your-api-server/api/public/seo/event-$1.html [R=302,L]
    
    # Angular routing (catch-all for regular users)
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^.*$ /index.html [L]
    
    # Optional: Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
</VirtualHost>
```

## 📝 Configuration Variables to Update

Replace these placeholders with your actual values:

- `your-api-server` → Your actual API server URL (e.g., `api.yourdomain.com` or `yourdomain.com:3000`)
- `yourdomain.com` → Your actual domain name
- `/path/to/your/angular/dist-prod` → Path to your built Angular app

### Example with Real Values:

```apache
RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot) [NC]
RewriteRule ^public/events/([0-9]+)/buy-tickets$ https://api.yourdomain.com/api/public/seo/event-$1.html [R=302,L]
```

## 🧪 Testing Your Configuration

### 1. Test Regular User Access
```bash
curl -H "User-Agent: Mozilla/5.0" https://yourdomain.com/public/events/123/buy-tickets
# Should return Angular app (index.html)
```

### 2. Test Social Crawler Access
```bash
curl -H "User-Agent: facebookexternalhit/1.1" https://yourdomain.com/public/events/123/buy-tickets
# Should redirect to SEO page with proper meta tags
```

### 3. Test Direct SEO Endpoint
```bash
curl https://your-api-server/api/public/seo/event-123.html
# Should return HTML with event-specific meta tags
```

### 4. Test with Facebook Sharing Debugger
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter: `https://yourdomain.com/public/events/123/buy-tickets`
3. Should show proper title, description, and event poster

## 🔧 Required Apache Modules

Make sure these Apache modules are enabled:

```bash
sudo a2enmod rewrite
sudo a2enmod headers
sudo systemctl reload apache2
```

## 🚨 Important Notes

### 1. API Server Access
- Your API server must be accessible from the internet for social crawlers
- If your API is on a different domain/port, ensure CORS is configured
- The API endpoint `/api/public/seo/event-:id.html` generates pages on-demand

### 2. HTTPS Configuration
For HTTPS sites, update the configuration:

```apache
<VirtualHost *:443>
    # ... SSL configuration ...
    
    RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot) [NC]
    RewriteRule ^/public/events/([0-9]+)/buy-tickets$ https://your-api-server/api/public/seo/event-$1.html [R=302,L]
</VirtualHost>
```

### 3. Performance Considerations
- The API generates pages on-demand (no static files to maintain)
- Consider adding caching headers to the API response for better performance
- Monitor API server load if you have high traffic

## 🎯 Advantages of This Approach

✅ **Works for new events immediately** - No rebuild/regeneration needed
✅ **No static file management** - Everything is generated on-demand
✅ **Always up-to-date** - SEO pages reflect current event information
✅ **Maintains Angular performance** - Regular users get the fast SPA experience
✅ **Multi-brand support** - API handles domain validation automatically

## 🔍 Troubleshooting

### Social media sharing not working?
1. Check if Apache modules are enabled: `apache2ctl -M | grep rewrite`
2. Test crawler detection: Use `curl` with different user agents
3. Verify API endpoint: Test the direct SEO URL
4. Check Apache error logs: `tail -f /var/log/apache2/error.log`

### Regular users seeing SEO pages?
- Check your user agent detection regex
- Ensure the catch-all rule for Angular routing is working

### API errors?
- Verify your API server is running and accessible
- Check that the event exists in your database
- Review API logs for any errors

## 📋 Deployment Checklist

- [ ] Build and deploy Angular app
- [ ] Build and deploy API server
- [ ] Update Apache configuration with correct URLs
- [ ] Enable required Apache modules
- [ ] Restart Apache
- [ ] Test with curl commands
- [ ] Test with Facebook Sharing Debugger
- [ ] Verify regular user access still works