<?php
    require_once('./inc/config.php');
    require_once('./inc/model/event.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/util/FileUploader.php');

    function createBuyShortlink($event) {
        $shortlinkPath = "Buy" . preg_replace('/[^a-z\d]+/i', '', $event->title);
        $fullUrl = "https://" . $_SERVER['SERVER_NAME'] . "/public/tickets/buy.php?id=" . $event->id;

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

    if(isset($_POST['id']) && $_POST['id'] != '') {
        $eventOld = new Event;
        $eventOld->fromID($_POST['id']);
    }
    $event = new Event;
    $event->fromFormPOST($_POST);
    if(isset($_FILES["poster_url"]["tmp_name"]) && $_FILES["poster_url"]["tmp_name"] != "") {
        $event->poster_url = uploadImage($_FILES['poster_url']);
    }
    $event->save();

    if (!isset($event->buy_shortlink) || $event->buy_shortlink == '' || !str_starts_with($event->buy_shortlink, 'http')) {
        $event->buy_shortlink = createBuyShortlink($event);
        $event->save();
    }

    $_SESSION['current_event'] = $event->id;

    redirectTo("/events.php?action=profile&status=" . $result);
?>