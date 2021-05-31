<?
    include_once('./inc/controller/get-artist-list.php');

    $artists = getAllArtists();
?>

<h3><?=$title;?></h3>
<form action="action.update-release.php" method="POST">
    <input type="hidden" name="artist_id_1" value="<?=$_SESSION['current_artist'];?>">
    <label for="description">Title</label>
        <input type="text" class="form-control" id="title" name="title" placeholder="Title">
    <div class="form-group">
        <label>Additional artists:</label><i class="fab fa-facebook-f"></i>
        <select class="form-control" name="artist_id_2">
            <option></option>
<?
    foreach($artists as $artist ) {
?>
            <option value="<?=$artist->id;?>"><?=$artist->name;?></option>

<?  } ?>
        </select>
        <select class="form-control" name="artist_id_3">
            <option></option>
<?
    foreach($artists as $artist ) {
?>
            <option value="<?=$artist->id;?>"><?=$artist->name;?></option>

<?  } ?>
        </select>
        <select class="form-control" name="artist_id_4">
            <option></option>
<?
    foreach($artists as $artist ) {
?>
            <option value="<?=$artist->id;?>"><?=$artist->name;?></option>

<?  } ?>
        </select>
    </div>
    <div class="form-group">
        <label for="catalog_no">Catalog Number</label>
        <input type="text" class="form-control" id="catalog_no" name="catalog_no" placeholder="Catalog Number">
    </div>
    <div class="form-group">
        <label for="UPC">UPC</label>
        <input type="text" class="form-control" id="UPC" name="UPC" placeholder="Catalog Number">
    </div>  
    <div class="form-release_date">
        <label for="amount">Release Date (YYYY-MM-DD)</label>
        <input type="text" class="form-control" id="release_date" name="release_date" placeholder="Release Date">
    </div> 
    <div class="form-check">
        <input class="form-check-input" type="checkbox" value="1" name="live" id="live">
        <label class="form-check-label" for="flexCheckDefault">
            Already released
  </label>
</div>
    <button type="submit" class="btn btn-default">Save Changes</button>
</form>