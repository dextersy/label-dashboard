<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/payment.php');

class PaymentViewItem {
    public $date_paid;
    public $description;
    public $amount;
}

function getPaymentsForArtist($artist_id){
    $sql = "SELECT `id` FROM `payment` " .
            "WHERE `artist_id` = ". $artist_id . " ".
            "ORDER BY `date_paid` DESC";
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $payment = new Payment;
        $payment->fromID($row['id']);

        $paymentViewItems[$i] = new PaymentViewItem;
        $paymentViewItems[$i]->date_paid = $payment->date_paid;
        $paymentViewItems[$i]->description = $payment->description;
        $paymentViewItems[$i]->amount = $payment->amount;

        $i++;
    }
    return $paymentViewItems;
}

?>