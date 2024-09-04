<?
    include_once("./inc/model/paymentmethod.php");
    include_once("./inc/model/artist.php");
    include_once("./inc/controller/payment-controller.php");
    session_start();
    $paymentViewItems = getPaymentsForArtist($_SESSION['current_artist']);

    $artist = new Artist;
    $artist->fromID($_SESSION['current_artist']);

    $banks = getSupportedBanksForTransfer();
?>

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
        <div class="alert alert-info">
        <i class="fa fa-info-circle"></i> Set the minimum amount to send automatic payouts. Minimum is P1,000. Charge of P10.00 is deducted from each payout.
        </div>
        <form action="action.set-payout-point.php" method="POST" enctype="multipart/form-data">
        <input type="hidden" name="id" value="<?=$artist->id;?>">
        <div class="input-group">
            <div class="input-group-addon">
                Php
            </div>
            <input type="number" min="1000" step="1" class="form-control text-right" name="payout_point" value="<?=$artist->payout_point;?>" required>
            <div class="input-group-btn">
                <button type="submit" class="btn btn-default">Save</button>
            </div>
        </div>
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
            $paymentMethods = getPaymentMethodsForArtist($_SESSION['current_artist']);
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
            
            <form action="action.add-payment-method.php" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
            <label>Bank name</label>
            <select class="form-control" name="bank_selection" id="type" required="true">
        <?php
            foreach($banks as $bank) {
        ?>
                <option value="<?=$bank->bank_code;?>,<?=$bank->bank_name;?>"><?=$bank->bank_name;?></option>
        <?php
            }
        ?>  
            </select>
            <label>Account name</label>
                <input type="text" class="form-control" name="account_name" required>
            <label>Account number</label>
                <input type="text" class="form-control" name="account_number_or_email" required>
            <div class="alert alert-info">
                <i class="fa fa-warning"></i> Before submitting, please make sure the details are correct. Payments sent to wrong accounts may not be recoverable.
            </div>
            <button type="submit" class="btn btn-default">Add Payment Method</button>
            </form>

    </div>
</div>
<!---
<script src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap-select@1.13.14/dist/js/bootstrap-select.min.js"></script>
--->