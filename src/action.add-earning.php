<?php
    require_once('./inc/model/earning.php');
    require_once('./inc/model/royalty.php');
    require_once('./inc/model/releaseartist.php');
    require_once('./inc/model/recuperableexpense.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-recuperable-expense.php');
    require_once('./inc/controller/access_check.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $earning = new Earning;
    $earning->fromFormPOST($_POST);
    $earning->save();
    
    // Calculate royalties
    if ( $_POST['calculateRoyalties'] == '1') {
        // Recup amount
        $recuperableExpenseBalance = getRecuperableExpenseBalance($_POST['release_id']);
        if ($earning->amount >= $recuperableExpenseBalance) {
            $recuperatedAmount = $recuperableExpenseBalance;
        }
        else {
            $recuperatedAmount = $earning->amount;
        }
        $earning->amount -= $recuperatedAmount; 
        $recuperableExpense = new RecuperableExpense(null, $_POST['release_id'], "Recouped from earnings", $recuperatedAmount*-1);
        $recuperableExpense->save();

        // Calculate royalties per artist
        if ($earning->amount > 0) {
            $artists = getArtistListForRelease($_POST['release_id']);
        }
        if ($artists) {
            foreach ($artists as $artist) {
                $releaseArtist = new ReleaseArtist;
                $releaseArtist->fromID($artist->id, $_POST['release_id']);
                switch($_POST['type']) {
                    case 'Sync': 
                        $royaltyBase = $releaseArtist->sync_royalty_type;
                        $royaltyPercent = $releaseArtist->sync_royalty_percentage;
                        break;
                    case 'Streaming':
                        $royaltyBase = $releaseArtist->streaming_royalty_type;
                        $royaltyPercent = $releaseArtist->streaming_royalty_percentage;
                        break;
                    case 'Downloads':
                        $royaltyBase = $releaseArtist->download_royalty_type;
                        $royaltyPercent = $releaseArtist->download_royalty_percentage;
                        break;
                    case 'Physical':
                        $royaltyBase = $releaseArtist->physical_royalty_type;
                        $royaltyPercent = $releaseArtist->physical_royalty_percentage;
                        break;
                    default: break;
                }
                
                if ($royaltyBase == 'Revenue') {
                    $royaltyAmount = $earning->amount * $royaltyPercent;
                }

                $royalty = new Royalty;
                $royalty->id = null;
                $royalty->artist_id = $artist->id;
                $royalty->earning_id = $earning->id;
                $royalty->amount = $royaltyAmount;
                $royalty->release_id = $_POST['release_id'];
                $royalty->description = "Royalties from " . $_POST['description'];
                
                $royalty->save();
            }
        }
    }

    function sendEarningsNotification($emailAddress, $artistName, $inviteHash) {
		$subject = "You've been invited to join ". $artistName . "'s team!";
		return sendEmail($emailAddress, $subject, generateEmailFromTemplate($artistName, $inviteHash));
	}

    function generateEmailFromTemplate($artistName, $inviteHash) {
		define ('TEMPLATE_LOCATION', 'assets/templates/invite_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/assets/img/logo-purple.png", $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'] . "/setprofile.php?u=" . $inviteHash, $msg);
		
		return $msg;
	}

    redirectTo("/financial.php#earning");
?>