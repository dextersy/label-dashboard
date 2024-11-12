<?php
    require_once('./inc/model/artist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/FileUploader.php');
    require_once('./inc/controller/users-controller.php');

    class ChangeRowItem {
        public $description;
        public $value;
    }

    function sendNotification($artistOld, $artist, $user, $brandName, $brandColor) {
        $i = 0;
        
        $admins = getAllAdmins($_SESSION['brand_id']);
        if ($admins != null) {
            foreach($admins as $recipient) {
                $emailAddresses[$i++] = $recipient->email_address;
            }
        }
        
        $users = getActiveTeamMembersForArtist($artist->id);
        if ($users != null) {
            foreach ($users as $recipient) {
                $emailAddresses[$i++] = $recipient->email_address;
            }
        }

		$subject = "Changes made to ". $artist->name . "'s profile!";
        $changeHistory = generateArtistDiffDetails($artistOld, $artist);
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artist->name, $changeHistory, $brandName, $brandColor, $user->first_name . ' ' . $user->last_name));
	}

    function generateArtistDiffDetails($old, $new) {
        $rows = []; $i = 0;
        if($old->name != $new->name) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Name';
            $rows[$i]->value = $old->name . ' → ' . $new->name;
            $i++;
        }
        if($old->website_page_url != $new->website_page_url) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Website URL';
            $rows[$i]->value = $old->website_page_url . ' → ' . $new->website_page_url;
            $i++;
        }
        if($old->facebook_handle != $new->facebook_handle) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Facebook Handle';
            $rows[$i]->value = $old->facebook_handle . ' → ' . $new->facebook_handle;
            $i++;
        }
        if($old->instagram_handle != $new->instagram_handle) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Instagram Handle';
            $rows[$i]->value = $old->instagram_handle . ' → ' . $new->instagram_handle;
            $i++;
        }
        if($old->twitter_handle != $new->twitter_handle) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Twitter Handle';
            $rows[$i]->value = $old->twitter_handle . ' → ' . $new->twitter_handle;
            $i++;
        }
        if($old->tiktok_handle != $new->tiktok_handle) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Tiktok Handle';
            $rows[$i]->value = $old->tiktok_handle . ' → ' . $new->tiktok_handle;
            $i++;
        }
        if($old->youtube_channel != $new->youtube_channel) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'YouTube Channel';
            $rows[$i]->value = $old->youtube_channel . ' → ' . $new->youtube_channel;
            $i++;
        }
        if($old->bio != $new->bio) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Bio';
            $rows[$i]->value = $old->bio . ' → ' . $new->bio;
            $i++;
        }
        if($old->profile_photo != $new->profile_photo) {
            $rows[$i] = new ChangeRowItem;
            $rows[$i]->description = 'Profile photo';
            $rows[$i]->value = 'Profile photo updated.';
            $i++;
        }

        $table = '<table width="100%" border="0" cellpadding="0"
                    cellspacing="0" role="presentation"><tr>
                    <td>
                        <table
                            class="pc-width-fill pc-w620-tableCollapsed-0"
                            border="0" cellpadding="0"
                            cellspacing="0" role="presentation"
                            width="100%"
                            style="border-collapse: separate; border-spacing: 0; width: 100%;">
                            <tbody>';

        foreach($rows as $row) {
            $table = $table . '<tr>
                            <td align="left" valign="top"
                                style="padding: 10px 10px 10px 10px;">
                                <table border="0"
                                    cellpadding="0"
                                    cellspacing="0"
                                    role="presentation"
                                    width="100%"
                                    style="border-collapse: separate; border-spacing: 0; margin-right: auto; margin-left: auto;">
                                    <tr>
                                        <td valign="top"
                                            align="left">
                                            <div class="pc-font-alt"
                                                style="line-height: 140%; letter-spacing: -0.2px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: normal; font-variant-ligatures: normal; color: #333333; text-align: left; text-align-last: left;">
                                                <div><span
                                                        style="font-weight: 700;font-style: normal;">'. $row->description .'</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td align="left" valign="top"
                                style="padding: 10px 10px 10px 10px;">
                                <table border="0"
                                    cellpadding="0"
                                    cellspacing="0"
                                    role="presentation"
                                    width="100%"
                                    style="border-collapse: separate; border-spacing: 0; margin-right: auto; margin-left: auto;">
                                    <tr>
                                        <td valign="top"
                                            align="left">
                                            <div class="pc-font-alt"
                                                style="line-height: 140%; letter-spacing: -0.2px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: normal; font-variant-ligatures: normal; color: #333333; text-align: left; text-align-last: left;">
                                                <div><span>' . $row->value . '</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>';
        }

        $table = $table . '</tbody>
                        </table>
                    </td>
                </tr>
            </table>';

        return $table;
    }

    function generateEmailFromTemplate($artistName, $changeHistory, $brandName, $brandColor, $memberName) {
		define ('TEMPLATE_LOCATION', 'assets/templates/artist_update_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
        $msg = str_replace('%CHANGED_ITEMS%', $changeHistory, $msg);
        $msg = str_replace('%BRAND_NAME%', $brandName, $msg);
        $msg = str_replace('%BRAND_COLOR%', $brandColor, $msg);
        $msg = str_replace('%MEMBER_NAME%', $memberName, $msg);
		$msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'] . "/artist.php", $msg);
		
		return $msg;
	}

    // Main procedure
    if(isset($_POST['id']) && strlen($_POST['id']) > 0) {
        $artistOld = new Artist;
        $artistOld->fromID($_POST['id']);
    }
    $artist = new Artist;
    $artist->fromFormPOST($_POST);
    if(isset($_FILES["profile_photo"]["tmp_name"]) && $_FILES["profile_photo"]["tmp_name"] != "") {
        $artist->profile_photo = uploadImage($_FILES['profile_photo']['name'], $_FILES['profile_photo']['tmp_name']);
    }
    $artist->save();

    $_SESSION['current_artist'] = $artist->id;
    
    $user = new User;
    $user->fromID($_SESSION['logged_in_user']);
    sendNotification($artistOld, $artist, $user, $_SESSION['brand_name'], $_SESSION['brand_color']);
    redirectTo("/artist.php?action=profile&status=OK");
?>