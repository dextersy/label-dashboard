<?php
    require_once('./inc/model/earning.php');
    require_once('./inc/model/royalty.php');
    require_once('./inc/model/releaseartist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/get-artist-list.php');

    $earning = new Earning;
    $earning->fromFormPOST($_POST);
    $earning->save();

    // Calculate royalties
    if ( $_POST['calculateRoyalties'] == '1') {
        $artists = getArtistListForRelease($_POST['release_id']);
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

    redirectTo("/financial.php#earning");
?>