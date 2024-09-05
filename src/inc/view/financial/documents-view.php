<?
    include_once('./inc/controller/document-controller.php');
    include_once('./inc/controller/access_check.php');

    $documents = getDocumentsForArtist($_SESSION['current_artist']);

?>
<script type="text/javascript">
    function onSelectDocument() {
        var path = document.getElementById('document_selection').value;
        document.getElementById('document_display').src = path;
    }
    function toggleUpload() {
        var currentDisplay = document.getElementById('upload_form').style.display;
        if(currentDisplay != 'none') {
            document.getElementById('upload_form').style.display = 'none';
        } 
        else {
            document.getElementById('upload_form').style.display = 'block';
        }
    }
</script>
<h3>Documents</h3>
<? if ($isAdmin) { ?>
<form action="action.upload-document.php" method="POST" enctype="multipart/form-data">
<input type="hidden" name="artist_id" id="artist_id" value="<?=$_SESSION['current_artist'];?>" />
<input type="hidden" name="date_uploaded" value="<?=Date("Y-m-d");?>">
<div class="row" id="upload_form" style="display:none">
    <div class="col-md-4">
        <div class="card">
            <div class="card-header"><h5><strong>Upload new</strong></h5></div>
            <div class="card-body">
                <input type="file" class="form-control" id="document" name="document" accept=".pdf" required>
                <div class="form-group">
                    <label for="description">Title</label>
                    <input type="text" class="form-control" id="title" name="title" placeholder="Title" required>
                </div>
            </div>
            <div class="card-footer">
                <button type="submit" class="btn btn-default">Upload</button>
            </div>
        </div>
    </div>
</div>
</form>
<? } ?>
<div class="row" style="padding:10px;">
    <div class="col-md-3">Select a document: 
        <select class="form-control" id="document_selection" onchange="onSelectDocument();">
    <? foreach($documents as $document) { 
            if(!isset($default_path)) {
                $default_path = $document->path;
            }
    ?>
            <option value="<?=$document->path;?>"><?=$document->title;?></option>
    <? } ?>
        </select>
    <? if ($isAdmin) { ?>
        <a href="#" onclick="toggleUpload();"><i class="fa fa-plus"></i></a>&nbsp; 
        <? if(isset($default_path)) { ?>
        <a href="action.delete-document.php?id=<?=$document->id;?>"><i class="fa fa-trash"></i></a>
    <?      
            }
        } ?>
    </div>
</div>
<div class="row">
    <div class="col-md-12">
        <embed id="document_display" src="<?=$default_path;?>" width="100%" height="800"></embed>
    </div>
</div>