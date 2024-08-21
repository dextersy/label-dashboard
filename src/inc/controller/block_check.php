<?
    include_once('./inc/util/Redirect.php');
    include_once('./inc/util/Mailer.php');

    function notifyAdminBlockedUser($remote_ip) {
        $subject = "Visitor blocked from accessing site.";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Maybe should be super admin or something...
        $body = $body. "A visitor has been blocked from accessing the site.<br>";
        $body = $body. "Remote login IP: " . $remote_ip . "<br>";
 		return sendEmail($emailAddresses, $subject, $body);
    }

    $ip_address =  $_SERVER['REMOTE_ADDR'];
    
    if( strpos(file_get_contents("./blocklist"), $ip_address) !== false) {
        session_start();
        session_destroy();

        notifyAdminBlockedUser($ip_address);
        
        redirectTo("/blocked.php");
        die();
    }
?>