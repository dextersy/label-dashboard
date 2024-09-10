<?php
require_once('./inc/config.php');
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/payment.php');
require_once('./inc/model/paymentmethod.php');
require_once('./inc/model/brand.php');

class PaymentViewItem {
    public $date_paid;
    public $description;
    public $amount;
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
        $paymentViewItems[$i]->payment_processing_fee;
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
    CURLOPT_URL => "https://api.paymongo.com/v1/wallets/receiving_institutions?provider=pesonet", // @TODO consider if only Pesonet should be supported
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

// @return Reference number, if successful. null if failed.
function sendPaymentThroughPaymongo($brand_id, $paymentMethodId, $amount, $description = '') {
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
                            'amount' => $amount * 100,
                            'receiver' => [
                                            'bank_account_name' => $paymentMethod->account_name,
                                            'bank_account_number' => $paymentMethod->account_number_or_email,
                                            'bank_code' => $paymentMethod->bank_code
                            ],
                            'provider' => 'pesonet',
                            'type' => 'send_money',
                            'description' => $description
                    ]
                ]
            ]),
            CURLOPT_HTTPHEADER => [
                "accept: application/json",
                "authorization: Basic c2tfbGl2ZV9MUHhxU3hSU2p1bU1vRDZhUW1SeTVaTEo6",
                "content-type: application/json"
            ],
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            return null;
        } else {
            // Return reference number
            $json = json_decode($response);
            return $json->data->attributes->reference_number;
        }
    }
    else {
        return null;
    }
}

?>