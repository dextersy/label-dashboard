<?php
require_once('./inc/config.php');
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/payment.php');
require_once('./inc/model/paymentmethod.php');
require_once('./inc/model/brand.php');
require_once('./inc/controller/get_team_members.php');
require_once('./inc/util/Mailer.php');

class PaymentViewItem {
    public $date_paid;
    public $description;
    public $amount;
    public $paid_thru_type;
    public $paid_thru_account_name;
    public $paid_thru_account_number;
    public $payment_processing_fee;
}

function payment_log($msg) {
    $fp = fopen('payments.log', 'a');
    $date = "[" . date("Y/m/d h:i:sa") . "] ";
    fwrite($fp, $date . $msg . "\n");
}

function getPaymentsForArtist($artist_id, $start=0, $limit=-1){
    $sql = "SELECT `id` FROM `payment` " .
            "WHERE `artist_id` = ". $artist_id . " ".
            "ORDER BY `date_paid` DESC";
    if ($limit >= 0) {
        $sql = $sql . " LIMIT ". $start .", " . $limit;
    }
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $payment = new Payment;
        $payment->fromID($row['id']);

        $paymentViewItems[$i] = new PaymentViewItem;
        $paymentViewItems[$i]->date_paid = $payment->date_paid;
        $paymentViewItems[$i]->description = $payment->description;
        $paymentViewItems[$i]->amount = $payment->amount;
        if(isset($payment->paid_thru_type)) {
            $paymentViewItems[$i]->paid_thru_type = $payment->paid_thru_type;
            $paymentViewItems[$i]->paid_thru_account_name = $payment->paid_thru_account_name;
            $paymentViewItems[$i]->paid_thru_account_number = $payment->paid_thru_account_number;
        }
        else if(isset($payment->payment_method_id)) {
            $paymentMethod = new PaymentMethod;
            $paymentMethod->fromID($payment->payment_method_id);

            $paymentViewItems[$i]->paid_thru_type = $paymentMethod->type;
            $paymentViewItems[$i]->paid_thru_account_name = $paymentMethod->account_name;
            $paymentViewItems[$i]->paid_thru_account_number = $paymentMethod->account_number_or_email;
        }
        $paymentViewItems[$i]->payment_processing_fee = $payment->payment_processing_fee;
        $i++;
    }
    return $paymentViewItems;
}

function getTotalPaymentsForArtist($artist_id, $start_date = null, $end_date = null){
    $sql = "SELECT SUM(`amount`) AS `total_payment` FROM `payment` " .
            "WHERE `artist_id` = ". $artist_id;
    if($start_date != null && $end_date != null) {
        $sql = $sql . " AND `date_paid` BETWEEN '" . $start_date . "' AND '" . $end_date . "'";
    }
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $totalPayments = $row['total_payment'];
    }
    return $totalPayments;
}

function getWalletBalance($brand_id) {
    $brand = new Brand;
    $brand->fromID($brand_id);
    
    $curl = curl_init();

    curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.paymongo.com/v1/wallets/" . $brand->paymongo_wallet_id,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "GET",
    CURLOPT_HTTPHEADER => [
        "accept: application/json",
        "authorization: Basic " . base64_encode(PAYMONGO_SECRET_KEY)
    ],
    ]);

    $response = curl_exec($curl);
    $err = curl_error($curl);

    if($err) {
        return -1;
    }
    else {
        $wallet = json_decode($response);
        return $wallet->data->attributes->available_balance / 100;
    }
}


class SupportedBankForTransfer {
    public $bank_code;
    public $bank_name;
    function __construct ($bank_code, $bank_name) {
        $this->bank_code = $bank_code;
        $this->bank_name = $bank_name;
    }
}
function getSupportedBanksForTransfer() {
    $curl = curl_init();

    curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.paymongo.com/v1/wallets/receiving_institutions?provider=instapay", // @TODO consider if only Instapay should be supported
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "GET",
    CURLOPT_HTTPHEADER => [
        "accept: application/json",
        "authorization: Basic " . base64_encode(PAYMONGO_SECRET_KEY)
    ],
    ]);

    $response = curl_exec($curl);
    $err = curl_error($curl);

    if($err) {
        return -1;
    }
    else {
        $i = 0;
        $supportedBanks = [];
        $bankList = json_decode($response);
        foreach ($bankList->data as $bank) {
            $supportedBanks[$i] = new SupportedBankForTransfer($bank->attributes->provider_code, $bank->attributes->name);
            $i++;
        }
        return $supportedBanks;
    }
}

function getPaymentMethodsForArtist($artist_id) {
    $sql = "SELECT * FROM `payment_method` WHERE `artist_id` = '" . $artist_id . "'";
    $result = MySQLConnection::query($sql);
    if ($result->num_rows < 1) {
        return null;
    }

    $i = 0;
    while($row = $result->fetch_assoc()) {
        $paymentMethods[$i++] = new PaymentMethod(
            $row['id'],
            $row['artist_id'],
            $row['type'],
            $row['account_name'],
            $row['account_number_or_email'],
            $row['is_default_for_artist']
        );
    }
    return $paymentMethods;
}

function makeAndSavePayment($payment, $brand) {
    return __addPayment($payment, false, $brand);
}
function saveManualPayment($payment, $brand) {
    return __addPayment($payment, true, $brand);
}
function __addPayment($payment, $isManualPayment, $brand) {
    payment_log("__addPayment: Payment details " . json_encode($payment));
    $success = true;

    if (isset($payment->payment_method_id) && $payment->payment_method_id != '' && !$isManualPayment) {
        // Pay through Paymongo
        $processing_fee = $brand->payment_processing_fee_for_payouts;
        payment_log("__addPayment: Processing fee " . json_encode($processing_fee));
        $referenceNumber = sendPaymentThroughPaymongo($brand->id, $payment->payment_method_id, $payment->amount - $processing_fee, $payment->description);
        if($referenceNumber != null) {
            $payment->payment_processing_fee = $processing_fee;
            $payment->reference_number = $referenceNumber;
            $success = true;
        }
        else {
            $success = false;
        }
    }
    
    if($success) {
        $payment->save();
        
        $GLOBALS['debugOutput'] = [];
        
        // Send email notification
        $artist = new Artist;
        $artist->fromID($payment->artist_id);
        $users = getActiveTeamMembersForArtist($artist->id);
        $i = 0;
        foreach ($users as $user) {
            $emailAddresses[$i++] = $user->email_address;
        }
        if ($i > 0) {
            __sendPaymentNotification(
                $emailAddresses, 
                $artist->name, 
                $payment,
                $brand->brand_name,
                $brand->brand_color,
                $brand->logo_url
            );
        }
    }
    
    return $success;
}


/// HELPER FUNCTIONS BELOW
function __sendPaymentNotification($emailAddresses, $artistName, $payment, $brandName, $brandColor, $brandLogo) {
    $subject = "Payment made to ". $artistName . "!";
    return sendEmail($emailAddresses, $subject, __generatePaymentEmailFromTemplate($artistName, $payment, $brandName, $brandColor, $brandLogo));
}

function __generatePaymentEmailFromTemplate($artistName, $payment, $brandName, $brandColor, $brandLogo) {
    define ('TEMPLATE_LOCATION', 'assets/templates/payment_notification_email.html', false);
    $file = fopen(TEMPLATE_LOCATION, 'r');
    $msg = fread($file, filesize(TEMPLATE_LOCATION));
    fclose($file);

    $msg = str_replace("%LOGO%", $brandLogo, $msg);
    $msg = str_replace("%BRAND_NAME%", $brandName, $msg);
    $msg = str_replace("%BRAND_COLOR%", $brandColor, $msg);
    $msg = str_replace('%ARTIST%', $artistName, $msg);
    $msg = str_replace('%AMOUNT%', "₱ " . number_format($payment->amount, 2), $msg);
    $msg = str_replace('%PROCESSING_FEE%', "₱ " . number_format($payment->payment_processing_fee, 2), $msg);
    $msg = str_replace('%NET_AMOUNT%', "₱ " . number_format($payment->amount - $payment->payment_processing_fee, 2), $msg);
    $msg = str_replace('%DESCRIPTION%', $payment->description, $msg);
    $msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'] . "/financial.php#payments", $msg);
    
    return $msg;
}


// @return Reference number, if successful. null if failed.
function sendPaymentThroughPaymongo($brand_id, $paymentMethodId, $amount, $description = '') {

    payment_log("sendPaymentThroughPaymongo: Amount = " . $amount);
    $brand = new Brand;
    $brand->fromID($brand_id);
    $walletID = $brand->paymongo_wallet_id;
    
    $paymentMethod = new PaymentMethod;
    $paymentMethod->fromID($paymentMethodId);

    if (isset($paymentMethod->bank_code) && isset($paymentMethod->account_name) && isset($paymentMethod->account_number_or_email)) {
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => "https://api.paymongo.com/v1/wallets/" . $walletID . "/transactions",
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => "",
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => "POST",
            CURLOPT_POSTFIELDS => json_encode([
                'data' => [
                    'attributes' => [
                            'amount' => round($amount * 100.00, 0),
                            'receiver' => [
                                            'bank_account_name' => $paymentMethod->account_name,
                                            'bank_account_number' => $paymentMethod->account_number_or_email,
                                            'bank_code' => $paymentMethod->bank_code
                            ],
                            'provider' => 'instapay',
                            'type' => 'send_money',
                            'description' => $description
                    ]
                ]
            ]),
            CURLOPT_HTTPHEADER => [
                "accept: application/json",
                "authorization: Basic " . base64_encode(PAYMONGO_SECRET_KEY),
                "content-type: application/json"
            ],
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            payment_log("Error occurred in CURL to Paymongo: " . $err);
            return null;
        } else {
            // Return reference number
            $json = json_decode($response);
            payment_log("JSON paymongo response: " . $response);
            return $json->data->attributes->reference_number;
        }
    }
    else {
        return null;
    }
}

?>