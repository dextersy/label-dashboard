<?
require_once('./inc/controller/page-check.php');

require_once('./inc/controller/get-release-list.php');
require_once('./inc/model/release.php');

$releases = getReleaseListForArtist($_SESSION['current_artist']);
?>

<h3><?=$title;?></h3>
<form action="action.add-earning.php" method="POST">
    <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
    <div class="form-group">
        <label for="websiteURL">Release</label><i class="fab fa-facebook-f"></i>
        <select class="form-control" name="release_id">
<?
    foreach($releases as $release ) {
?>
            <option value="<?=$release->id;?>"><?=$release->catalog_no;?>: <?=$release->title;?></option>

<?  } ?>
        </select>
    </div>
    <div class="form-group">
        <label for="earningDate">Earning Date</label>
        <input type="date" class="form-control" id="earningDate" name="date_recorded" value="<?=date("Y-m-d");?>">
    </div>
    <div class="form-group">
        <label for="websiteURL">Earning Type</label>
        <select class="form-control" name="type">
            <option value="Sync">Sync</option>
            <option value="Streaming">Streaming</option>
            <option value="Downloads">Downloads</option>
            <option value="Physical">Physical</option>
        </select>
    </div>
    <div class="form-group">
        <label for="description">Description</label>
        <input type="text" class="form-control" id="description" name="description" placeholder="Description">
    </div>
    <div class="form-group">
        <label for="amount">Amount (in PHP)</label>
        <input type="text" class="form-control" id="amount" name="amount" placeholder="Amount">
    </div> 

    <div class="form-group">
        <input class="form-check-input" type="checkbox" value="1" name="calculateRoyalties" id="calculateRoyalties" checked>
        <label class="form-check-label" for="flexCheckDefault">
            Calculate Royalties
    </div> 
    <button type="submit" class="btn btn-default">Save</button>
</form>