<?
require_once('./inc/controller/get-release-list.php');
require_once('./inc/model/release.php');

$releases = getReleaseListForArtist($_SESSION['current_artist']);
?>

<h3><?=$title;?></h3>
<form action="action.add-royalty.php" method="POST">
    <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
    <div class="form-group">
        <label for="websiteURL">Release</label><i class="fab fa-facebook-f"></i>
        <select class="form-control" name="release_id">
            <option value="0">(None)</option>
<?
    foreach($releases as $release ) {
?>
            <option value="<?=$release->id;?>"><?=$release->catalog_no;?>: <?=$release->title;?></option>

<?  } ?>
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
    <button type="submit" class="btn btn-default">Save Changes</button>
</form>