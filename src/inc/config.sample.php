<?php
// ONCE YOU'RE DONE UPDATING, PLEASE RENAME THIS FILE TO CONFIG.PHP 
// TO REFLECT IN ACTUAL SERVER

// Update your actual server, database, user, and password here
define('DB_SERVER', 'localhost');
define('DB_DATABASE', 'meltrecords_dashboard');
define('DB_USER', '');
define('DB_PASSWORD', '');

// Update your actual SMTP configuration here
define('SMTP_HOST', 'email-smtp.ap-southeast-1.amazonaws.com');
define('SMTP_PORT', '587');
define('SMTP_SECURE', 'tls');
define('SMTP_USER', '');
define('SMTP_PASS', '');

// Input Paymongo secret key for events payments
define('PAYMONGO_SECRET_KEY', '');

// Login security
define('FAILED_LOGIN_LIMIT', 3);
define('LOCK_TIME_IN_SECONDS', 120);

// Input Short.io key for events shortlinking
define('SHORT_IO_KEY', '');
define('SHORT_IO_DOMAIN', '');

// S3 details -- get this from your AWS account
define('S3_BUCKET', '');
define('S3_ACCESS_KEY', '');
define('S3_SECRET_KEY', '');
define('S3_REGION', ''); // e.g. 'ap-southeast-1'
?>
