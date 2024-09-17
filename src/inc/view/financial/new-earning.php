<?
require_once('./inc/controller/page-check.php');

require_once('./inc/controller/get-release-list.php');
require_once('./inc/model/release.php');

$releases = getReleaseListForArtist($_SESSION['current_artist']);
?>

<form action="action.add-earning.php" method="POST">
<div class="card">
    <div class="card-header">
        <h4 class="title">Record new earnings</h4>
    </div>

    <div class="card-body">
        <div class="alert alert-info">
            <i class="fa fa-info-circle"></i> If you are inputting multiple earnings, we recommend using the <a href="admin.php#bulk-add-earnings">bulk add earnings</a> feature to save you time!
        </div>
        <div class="col-md-6">
        <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
        <div class="form-group">
            <label for="websiteURL">Release</label><i class="fab fa-facebook-f"></i>
            <select class="form-control" name="release_id" required>
    <?
        foreach($releases as $release ) {
    ?>
                <option value="<?=$release->id;?>"><?=$release->catalog_no;?>: <?=$release->title;?></option>

    <?  } ?>
            </select>
        </div>
        <div class="form-group">
            <label for="earningDate">Earning Date</label>
            <input type="date" class="form-control" id="earningDate" name="date_recorded" value="<?=date("Y-m-d");?>" required>
        </div>
        <div class="form-group">
            <label for="websiteURL">Earning Type</label>
            <select class="form-control" name="type" required>
                <option value="Sync">Sync</option>
                <option value="Streaming">Streaming</option>
                <option value="Downloads">Downloads</option>
                <option value="Physical">Physical</option>
            </select>
        </div>
        </div>
        <div class="col-md-6">
        <div class="form-group">
            <label for="description">Description</label>
            <input type="text" class="form-control" id="description" name="description" placeholder="Description" required>
        </div>
        <div class="form-group">
            <label for="amount">Amount (in PHP)</label>
            <input type="text" class="form-control" id="amount" name="amount" placeholder="Amount" required>
        </div> 

        <div class="form-group">
            <input class="form-check-input" type="checkbox" value="1" name="calculateRoyalties" id="calculateRoyalties" checked>
            <label class="form-check-label" for="flexCheckDefault">
                Calculate Royalties
        </div> 
        </div>
    </div>
    <div class="card-footer save-panel">
        <button type="submit" class="btn btn-primary btn-block">Save</button>
    </div>
</div>
</form>