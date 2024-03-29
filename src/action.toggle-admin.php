<?php
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/FileUploader.php');

    if(isset($_GET['id']) && strlen($_GET['id']) > 0) {
        $user = new User;
        $user->fromID($_GET['id']);
        $user->is_admin = !($user->is_admin);
        $user->save();
    }
    
    //sendNotification($artistOld, $artist);

    // function sendNotification($artistOld, $artist) {
    //     $i = 0;
        
    //     $admins = getAllAdmins($_SESSION['brand_id']);
    //     if ($admins != null) {
    //         foreach($admins as $recipient) {
    //             $emailAddresses[$i++] = $recipient->email_address;
    //         }
    //     }
        
    //     $users = getActiveTeamMembersForArtist($artist->id);
    //     if ($users != null) {
    //         foreach ($users as $recipient) {
    //             $emailAddresses[$i++] = $recipient->email_address;
    //         }
    //     }

	// 	$subject = "Changes made to ". $artist->name . "'s profile!";
    //     $changeHistory = generateArtistDiffDetails($artistOld, $artist);
	// 	return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artist->name, $changeHistory));
	// }

    // function generateArtistDiffDetails($old, $new) {
    //     $table = "<table><tr><td>Field</td><td>New value</td></tr>";
    //     if($old->name != $new->name) {
    //         $table = $table . "<tr><td>Name</td><td>" . $new->name . "</td></tr>";
    //     }
    //     if($old->website_page_url != $new->website_page_url) {
    //         $table = $table . "<tr><td>Website URL</td><td>" . $new->website_page_url . "</td></tr>";
    //     }
    //     if($old->facebook_handle != $new->facebook_handle) {
    //         $table = $table . "<tr><td>Facebook</td><td>" . $new->facebook_handle . "</td></tr>";
    //     }
    //     if($old->instagram_handle != $new->instagram_handle) {
    //         $table = $table . "<tr><td>Instagram Handle</td><td>" . $new->instagram_handle . "</td></tr>";
    //     }
    //     if($old->twitter_handle != $new->twitter_handle) {
    //         $table = $table . "<tr><td>Twitter Handle</td><td>" . $new->twitter_handle . "</td></tr>";
    //     }
    //     if($old->bio != $new->bio) {
    //         $table = $table . "<tr><td>Bio</td><td>" . $new->bio . "</td></tr>";
    //     }
    //     if($old->profile_photo != $new->profile_photo) {
    //         $table = $table . "<tr><td>Profile Photo</td><td>New photo uploaded.</td></tr>";
    //     }
    //     $table = $table . "</table>";
    //     return $table;
    // }

    // function generateEmailFromTemplate($artistName, $changeHistory) {
	// 	define ('TEMPLATE_LOCATION', 'assets/templates/artist_update_email.html', false);
	// 	$file = fopen(TEMPLATE_LOCATION, 'r');
	// 	$msg = fread($file, filesize(TEMPLATE_LOCATION));
	// 	fclose($file);

    //     $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
	// 	$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
    //     $msg = str_replace('%CHANGED_ITEMS%', $changeHistory, $msg);
	// 	$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'], $msg);
		
	// 	return $msg;
	// }

    redirectTo("/admin.php?action=make-admin&status=" . $result);
?>