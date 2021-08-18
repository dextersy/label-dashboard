<?php
    require_once('./inc/model/earning.php');
    require_once('./inc/model/royalty.php');
    require_once('./inc/model/release.php');
    require_once('./inc/model/releaseartist.php');
    require_once('./inc/model/recuperableexpense.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-recuperable-expense.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/Mailer.php');

    function processNewEarning($earning, $calculateRoyalties) {

        // Recup amount
        $recuperableExpenseBalance = getRecuperableExpenseBalance($earning->release_id);
        if ($earning->amount >= $recuperableExpenseBalance) {
            $recuperatedAmount = $recuperableExpenseBalance;
        }
        else {
            $recuperatedAmount = $earning->amount;
        }
        $earningRemainingForRoyalties = $earning->amount - $recuperatedAmount; 
        $recuperableExpense = new RecuperableExpense(null, $earning->release_id, "Recouped from earnings", $recuperatedAmount*-1, $earning->date_recorded);
        $recuperableExpense->save();
    
        $release = new Release;
        $release->fromID($earning->release_id);
        $artists = getArtistListForRelease($earning->release_id);
        
        if ($artists) {
            foreach ($artists as $artist) {
                unset($royalty);
                // Calculate royalties
                if ( $calculateRoyalties == true && $earningRemainingForRoyalties > 0 ) {
                    $releaseArtist = new ReleaseArtist;
                    $releaseArtist->fromID($artist->id, $earning->release_id);
                    switch($earning->type) {
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
                        $royaltyAmount = $earningRemainingForRoyalties * $royaltyPercent;
                    }

                    $royalty = new Royalty;
                    $royalty->id = null;
                    $royalty->artist_id = $artist->id;
                    $royalty->earning_id = $earning->id;
                    $royalty->amount = $royaltyAmount;
                    $royalty->release_id = $earning->release_id;
                    $royalty->description = "Royalties from " . $earning->description;
                    $royalty->date_recorded = $earning->date_recorded;
                    $royalty->save();
                }

                // Send email notification
                $users = getActiveTeamMembersForArtist($artist->id);
                $i = 0;
                foreach ($users as $user) {
                    $emailAddresses[$i++] = $user->email_address;
                }
                if ($i > 0) {
                    sendEarningsNotification(
                        $emailAddresses, 
                        $artist, 
                        $release, 
                        $earning, 
                        $recuperatedAmount,
                        $royalty
                    );
                }
            }
        }
    }

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
?>