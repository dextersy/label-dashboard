# Melt Records Artist Dashboard

At Melt Records, we believe in *transparency* first and foremost - that we should NOT be afraid to share and engage in conversations with our artist regarding what we do, how we do it, and how much we make out of it.

This dashboard is an effort to exemplify this value, by providing our artists easy access to as much information as is available, without obscuring the important details.

To further encourage transparency, we've released this dashboard as a public and open-source repository, so others may use it freely for their own purposes and audit the implementation to make sure that calculations and other things are carried out correctly.

Feel free to fork this repository for your own modifications. I'd be happy to get your contributions to this dashboard!

\- **Dexter Sy**, Melt Records

## Quick start

This project requires a working web server (Nginx, Apache, or any HTTP server of your choice), the PHP modules (recommended at least PHP 7.3), and MySQL.

[Note: There is not yet a MySQL schema included as of August 2021. This will be added in a future commit.]

### To get started:
1. Copy all the files in `src` to your web server document root. (Refer to your web server's manual for details on how to set up local domains, as needed.)
2. Make a copy or rename `inc/config.php.sample` to `inc/config.php`.
3. Input the necessary details for your database server and SMTP server on `config.php`. The following information is needed:
        
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

    `Note: Don't forget to change DB_SERVER, DB_DATABASE, SMTP_PORT, SMTP_SECURE to your actual database and SMTP settings. The included values are only examples.`

4. Run the app on your PHP-enabled webserver and access it through http://localhost

    `Note: Due to limitations of the code, it's not currently possible to run the app on a subdirectory (e.g. localhost/meltrecords) - this results in unexpected behavior. If you are hosting more than one site on your web server, please set up vhosts locally.`

### License
Copyright 2021 Dexter Sy & Melt Records (https://www.melt-records.com)

Copyright 2019 Creative Tim (http://www.creative-tim.com)

Licensed under MIT (https://github.com/creativetimofficial/light-bootstrap-dashboard/blob/master/LICENSE.md)

## Useful Links

Social Media:

Twitter: https://twitter.com/meltrecordsph

Facebook: https://www.facebook.com/meltrecordsph

Instagram: https://instagram.com/meltrecordsph
