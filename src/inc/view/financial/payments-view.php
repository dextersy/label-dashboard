<?
    include_once("./inc/model/paymentmethod.php");
    include_once("./inc/model/artist.php");
    include_once("./inc/controller/get-payments.php");
    session_start();
    $paymentViewItems = getPaymentsForArtist($_SESSION['current_artist']);

    $artist = new Artist;
    $artist->fromID($_SESSION['current_artist']);

    $banklist = file_get_contents("./assets/banklist"); // @TODO Better to do via real time API, if possible
    $banks = explode("\n", $banklist);
?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.6.3/js/bootstrap-select.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.2/js/bootstrap.js"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.6.3/css/bootstrap-select.css" rel="stylesheet"/>
<link href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.2/css/bootstrap.css" rel="stylesheet"/>

<div class="row">
    <div class="col-md-6">
        <h3>Payments and Advances <? if ($isAdmin) { ?><a data-toggle="tab" href="#new-payment"><i class="fa fa-plus"></i></a><? } ?></h3>
        <div class="table-responsive">
            <table class="table">
                <thead>
                    <tr><th>Date Paid</th>
                    <th>Description</th>
                    <th>Paid Through</th>
                    <th style="text-align:right">Amount</th>
                </thead>
                <tbody>
                <? if ($paymentViewItems) {
                    foreach($paymentViewItems as $paymentViewItem) { ?>
                    <tr>
                        <td><?=$paymentViewItem->date_paid;?></td>
                        <td><?=$paymentViewItem->description;?></td>
                        <td><?=$paymentViewItem->paid_thru_type;?> - <?=$paymentViewItem->paid_thru_account_name;?> - <?=$paymentViewItem->paid_thru_account_number;?></td>
                        <td align="right"><?=number_format($paymentViewItem->amount, 2);?></td>                
                    </tr>
                <?  }
                } else {
                ?>
                    No payments and advances yet.
                <? } ?>
                </tbody>
            </table>
        </div>
        <h3>Payout point</h3>
        <p><i class="fa fa-info-circle"></i> Set the amount to receive payouts. Minimum is P1,000. Charge of P10.00 is deducted from each payout.</p>
        <form action="action.set-payout-point.php" method="POST" enctype="multipart/form-data">
        <input type="hidden" name="id" value="<?=$artist->id;?>">
        <input type="number" min="1000" class="form-control" name="payout_point" value="<?=$artist->payout_point;?>" required>
        <button type="submit" class="btn btn-default">Save</button>
        </form>
    </div>
    <div class="col-md-6">
        <h3>Payment Methods</h3>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr><th>Bank</th>
                        <th>Account Name</th>
                        <th>Account Number</th>
                        <th></th>
                    </thead>
                    <tbody>
        <? 
            $paymentMethods = PaymentMethod::getPaymentMethodsForArtist($_SESSION['current_artist']);
            if ($paymentMethods) {
                foreach ($paymentMethods as $paymentMethod) { 
                ?>
                    <tr>
                        <td><?=$paymentMethod->type;?></td>
                        <td><?=$paymentMethod->account_name;?></td>
                        <td><?=$paymentMethod->account_number_or_email;?></td>
                        <td>
                            <?=$paymentMethod->is_default_for_artist?"<strong>Default</strong>":"[ Set as default ]";?>
                        </td>
                    </tr>
        <?          
                } 
            } else { ?>
            No payment methods set.
        <?  } ?>
                    </tbody>
                </table>
            </div>
            
            <h4>Add bank details</h4>
            <div class="badge badge-pill badge-warning">
                <i class="fa fa-warning"></i> Please make sure the details are correct. Payments sent to wrong accounts may not be recoverable.
            </div>
            <form action="action.add-payment-method.php" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
            <label>Bank name</label>
            <select class="selectpicker form-control" data-live-search="true" name="type" id="type" required>
        <?php
            foreach($banks as $bank) {
        ?>
                <option value="<?=$bank;?>"><?=$bank;?></option>
        <?php
            }
        ?>  
            </select>
            <label>Account name</label>
                <input type="text" class="form-control" name="account_name" required>
            <label>Account number</label>
                <input type="text" class="form-control" name="account_number_or_email" required>
            
            <button type="submit" class="btn btn-default">Add Payment Method</button>
            </form>

    </div>
</div>