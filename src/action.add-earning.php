<?php
    require_once('./inc/model/earning.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/earning-processor.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $earning = new Earning;
    $earning->fromFormPOST($_POST);
    $earning->save();

    processNewEarning($earning, ($_POST['calculateRoyalties']=='1'));

    function sendEarningsNotification ( $emailAddress, $artist, $release, $earning, $recuperatedAmount, $royalty) 
    {
		$subject = "New earnings posted for ". $artist->name . " - " . $release->title;
		return sendEmail($emailAddress, $subject, 
                    generateEmailFromTemplate(
                        $artist->name, 
                        $release->title,
                        $earning->description,
                        number_format($earning->amount, 2),
                        number_format($recuperatedAmount, 2),
                        number_format(getRecuperableExpenseBalance($release->id), 2),
                        isset($royalty)? number_format($royalty->amount, 2) : null
                        )
                    );
	}

    function generateEmailFromTemplate($artistName, $releaseName, $earningDescription, 
            $earningAmount, $recuperatedAmount, $recuperableExpenseBalance, $royaltyAmount) {
		define ('TEMPLATE_LOCATION', 'assets/templates/earning_notification.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/assets/img/logo-purple.png", $msg);
		$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
        $msg = str_replace('%RELEASE_TITLE%', $releaseName, $msg);
        $msg = str_replace('%EARNING_DESC%', $earningDescription, $msg);
        $msg = str_replace('%EARNING_AMOUNT%', $earningAmount, $msg);
        $msg = str_replace('%RECUPERATED_EXPENSE%', $recuperatedAmount, $msg);
        $msg = str_replace('%RECUPERABLE_BALANCE%', $recuperableExpenseBalance, $msg);
        $msg = str_replace('%ROYALTY%', $royaltyAmount!=null? $royaltyAmount: "(Not applied)", $msg);
		$msg = str_replace('%URL%', "https://artists.melt-records.com", $msg);
		
		return $msg;
	}

    redirectTo("/financial.php#earning");
?>