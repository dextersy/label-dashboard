<?php
    require_once('./inc/model/eventreferrer.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Mailer.php');

    function createReferralShortlink($eventReferrer, $shortlinkPath) {
        $fullUrl = "https://" . $_SERVER['SERVER_NAME'] . "/public/tickets/buy.php?id=" . $eventReferrer->event_id . "&ref=" . $eventReferrer->referral_code;

        $curl = curl_init();

        curl_setopt_array($curl, [
            CURLOPT_URL => "https://api.short.io/links",
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => "",
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => "POST",
            CURLOPT_POSTFIELDS => json_encode([
                'domain' => SHORT_IO_DOMAIN,
                'originalURL' => $fullUrl,
                'path' => $shortlinkPath
            ]),
            CURLOPT_HTTPHEADER => [
                "Authorization: " . SHORT_IO_KEY,
                "accept: application/json",
                "content-type: application/json"
            ],
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            echo $err;
            // TODO log error
            return null;
        } else {
            $data = json_decode($response, false);
            return $data->secureShortURL;
        }
    }

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $referrer = new EventReferrer;
    $referrer->fromFormPOST($_POST);
    $referrer->save();

    if (!isset($referrer->referral_shortlink) || $referrer->referral_shortlink == '' || substr( $referrer->referral_shortlink, 0, 4 ) != "http" ) {
        $shortlinkPath = "Buy" . preg_replace('/[^a-z\d]+/i', '', $eventReferrer->referral_code);
        if (isset($_POST['slug']) && $_POST['slug'] != '') {
            $shortlinkPath = $_POST['slug'];
        }
        $referrer->referral_shortlink = createReferralShortlink($referrer, $shortlinkPath);
        $referrer->save();
    }

    redirectTo("/events.php#referrers");
?>