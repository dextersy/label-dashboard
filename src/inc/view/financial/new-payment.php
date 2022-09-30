<?
    session_start();
    $totalRoyalties = getTotalRoyaltiesForArtist($_SESSION['current_artist']);
    $totalPayments = getTotalPaymentsForArtist($_SESSION['current_artist']);
    $totalBalance = $totalRoyalties - $totalPayments;

    $paymentMethods = PaymentMethod::getPaymentMethodsForArtist($_SESSION['current_artist']);
?>

<h3><?=$title;?></h3>
<div class="col-md-6">
<form action="action.add-payment.php" method="POST">
    <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
    <div class="form-group">
        <label for="earningDate">Payment Date</label>
        <input type="date" class="form-control" id="paymentDate" name="date_paid" value="<?=date("Y-m-d");?>">
    </div>
    <div class="form-group">
        <label for="description">Description</label>
        <input type="text" class="form-control" id="description" name="description" placeholder="Description">
    </div>
    <div class="form-group">
        <label for="amount">Amount (in PHP)</label>
        <input type="text" class="form-control" id="amount" name="amount" placeholder="Amount" value="<?=$totalBalance;?>">
    </div> 
    <div class="form-group">
        <label for="paid_thru">Paid through</label>
        <select name="paid_thru" class="form-control">
<?php   
    foreach($paymentMethods as $paymentMethod) {
?>
            <option><?=$paymentMethod->type . " - " . $paymentMethod->account_name . " - " . $paymentMethod->account_number_or_email;?></option>
<?php
    }
?>
        </select>
    </div>
    <button type="submit" class="btn btn-default">Add Payment</button>
</form>
</div>