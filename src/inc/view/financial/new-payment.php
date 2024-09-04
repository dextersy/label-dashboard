<?
    include_once('./inc/controller/payment-controller.php');
    session_start();
    $totalRoyalties = getTotalRoyaltiesForArtist($_SESSION['current_artist']);
    $totalPayments = getTotalPaymentsForArtist($_SESSION['current_artist']);
    $totalBalance = $totalRoyalties - $totalPayments;

    $paymentMethods = getPaymentMethodsForArtist($_SESSION['current_artist']);

    $currentBalance = getWalletBalance($_SESSION['brand_id']);
?>
<script type="text/javascript">
    function checkBalance() {
        var errorMessageElement = document.getElementById('error-messages');
        var isManualPayment = document.getElementById('checkbox_manualPayment').checked;
        var walletBalance = Number(document.getElementById('wallet_balance').value);
        var paymentAmount = Number(document.getElementById('payment_amount').value);

        if (isManualPayment || walletBalance >= paymentAmount) {
            document.getElementById('btn_submit').disabled = false;
            errorMessageElement.style.display = 'none';
        }
        else {
            document.getElementById('btn_submit').disabled = true;
            errorMessageElement.style.display = 'block';
            errorMessageElement.innerHTML = "Not enough money in your balance.";
        }
    }

    function toggleManualPayment() {
        var isManualPayment = document.getElementById('checkbox_manualPayment').checked;
        var referenceNumberDiv = document.getElementById('div_referenceNumber');
        var availableBalanceDiv = document.getElementById('div_availableBalance');

        referenceNumberDiv.style.display = isManualPayment ? 'block': 'none';
        availableBalanceDiv.style.display = isManualPayment ? 'none': 'block';
        
        checkBalance();
    }
</script>
<h3><?=$title;?></h3>
<div class="col-md-6">
<form action="action.add-payment.php" method="POST">
    <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
    <div class="form-group">
        <label for="earningDate">Payment Date</label>
        <input type="date" class="form-control" id="paymentDate" name="date_paid" value="<?=date("Y-m-d");?>" required>
    </div>
    <div class="form-group">
        <label for="description">Description</label>
        <input type="text" class="form-control" id="description" name="description" placeholder="Description" required>
    </div>
    <div class="form-group">
        <label for="amount">Amount (in PHP)</label>
        <input type="number" step="0.01" class="form-control" id="payment_amount" name="amount" placeholder="Amount" value="<?=$totalBalance;?>" onchange="checkBalance();" required min="1">
    </div> 
    <div class="form-group">
        <label for="select_paymentMethod">Paid through</label>
        <select name="payment_method_id" id="select_paymentMethod" class="form-control">
<?php   
    foreach($paymentMethods as $paymentMethod) {
?>
            <option value="<?=$paymentMethod->id;?>"><?=$paymentMethod->type . " - " . $paymentMethod->account_name . " - " . $paymentMethod->account_number_or_email;?></option>
<?php
    }
?>
        </select>
    </div>
    <div class="form-group">
        <input class="form-check-input" type="checkbox" value="1" id="checkbox_manualPayment" name="manualPayment" onclick="toggleManualPayment();">
        <label class="form-check-label" for="manualPayment">
            This is a manual payment.
        </label> 
    </div>
    <div id="div_referenceNumber" class="form-group">
        <label for="amount">Reference Number</label>
        <input type="text" class="form-control" id="txt_referenceNumber" name="reference_number" placeholder="Reference Number">
    </div> 
    <div class="badge badge-pill badge-info" id="div_availableBalance">
        Available balance: Php <?=number_format($currentBalance, 2);?>
        <input type="hidden" id="wallet_balance" value="<?=$currentBalance;?>">
    </div>

    <input type="submit" id="btn_submit" class="btn btn-default" value="Add Payment">
</form>
<div id="error-messages" class="alert alert-warning" role="alert">
  A simple warning alert—check it out!
</div>
<script type="text/javascript">
checkBalance();
toggleManualPayment()
</script>
</div>