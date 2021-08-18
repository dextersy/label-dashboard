<?
session_start();
?>

<h3><?=$title;?></h3>
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
        <input type="text" class="form-control" id="amount" name="amount" placeholder="Amount">
    </div> 
    <button type="submit" class="btn btn-default">Save Changes</button>
</form>