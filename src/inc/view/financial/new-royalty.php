<?
require_once('./inc/controller/get-release-list.php');
require_once('./inc/model/release.php');

$releases = getReleaseListForArtist($_SESSION['current_artist']);
?>

<form action="action.add-royalty.php" method="POST">
<div class="card">
    <div class="card-header">
        <h4 class="title">Record new royalty</h4>
    </div>
    <div class="card-body">
        <div class="col-md-6">
            <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
            <div class="form-group">
                <label for="websiteURL">Release</label><i class="fab fa-facebook-f"></i>
                <select class="form-control" name="release_id" required>
                    <option value="0">(None)</option>
        <?
            foreach($releases as $release ) {
        ?>
                    <option value="<?=$release->id;?>"><?=$release->catalog_no;?>: <?=$release->title;?></option>

        <?  } ?>
                </select>
            </div>
            <div class="form-group">
                <label for="royaltyDate">Royalty Date</label>
                <input type="date" class="form-control" id="royaltyDate" name="date_recorded" value="<?=date("Y-m-d");?>" required>
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
        </div>
    </div>
    <div class="card-footer save-panel">
    <button type="submit" class="btn btn-primary btn-block">Save Changes</button>
    </div>
</div>
</form>