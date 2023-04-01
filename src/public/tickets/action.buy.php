<?
    chdir("../..");
    include_once("./inc/model/ticket.php");
    include_once("./inc/model/event.php");
    include_once("./inc/util/Redirect.php");
    include_once("./inc/config.php");

    function createPaymentLink($amount, $description) {

        $curl = curl_init();

        curl_setopt_array($curl, [
                CURLOPT_URL => "https://api.paymongo.com/v1/links",
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => "",
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => "POST",
                CURLOPT_POSTFIELDS => "{\"data\":{\"attributes\":{\"amount\":". $amount*100 . ",\"description\":\"" . $description . "\"}}}",
                CURLOPT_HTTPHEADER => [
                    "accept: application/json",
                    "authorization: Basic " . PAYMONGO_SECRET_KEY,
                    "content-type: application/json"
                ],
            ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            return $err;
        } else {
            return json_decode($response, false);
        }
    }

    $ticket = new Ticket;
    $ticket->fromFormPOST($_POST);
    $ticket->status = "New";
    // Generate ticket code
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $randomString = '';
    for ($i = 0; $i < 5; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }
    $ticket->ticket_code = $randomString;
    $ticket->save();

    $event = new Event;
    $event->fromID($ticket->event_id);

    $amount = $event->ticket_price * $ticket->number_of_entries;
    $description = "Payment for " . $event->title . " - Ticket # " . $ticket->id;
    $response = createPaymentLink($amount, $description);

    if(isset($response->data->attributes)) {
        $ticket->payment_link = $response->data->attributes->checkout_url;
        $ticket->payment_link_id = $response->data->id;
        $ticket->save();
    }
    else {
        echo $response;
    }

    // todo Send notification

    redirectTo("/public/tickets/pay.php?id=" . $ticket->id);
?>