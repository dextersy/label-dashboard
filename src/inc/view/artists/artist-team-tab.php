<?
    include_once('./inc/controller/get_team_members.php');

    include_once('./inc/controller/brand_check.php');

    $userAccessRights = getTeamMembersForArtist($_SESSION['current_artist']);

    function getUserStatusString($status) {
        if ( $status == "Pending" ) {
            $color = 'gray';
        }
        else if ($status == "Accepted") {
            $color = 'green';
        }
        return "<span style=\"color:". $color . ";\"><i class=\"fa fa-circle\" aria-hidden=\"true\"></i>" . $status . "</span>";
    }
?>
<h3>Assigned Team Members</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Name</th>
            <th>Email address</th>
            <th>Artist Access</th>
            <th>Financial Access</th>
            <th>Status</th>
            <th>Actions</th></tr>
        </thead>
        <tbody>
<?
    if ($userAccessRights) {
        foreach($userAccessRights as $user) {
?>
            <tr>
                <td><?=$user->first_name . " " . $user->last_name; ?></td>
                <td><?=$user->email_address; ?></td>
                <td>Read</td>
                <td>Read</td>
                <td><?=getUserStatusString($user->status); ?></td>
                <td>
                <?php if ($user->status == 'Pending') { ?>
                    <form action="action.invite.php" method="POST">
                        <input type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
                        <input type="hidden" name="email_address" value="<?=$user->email_address;?>">
                        <input type="hidden" name="invite_hash" value="<?=$user->invite_hash;?>">
                        <input type="submit" class="btn" value="Resend invite">
                    </form>
                <?php } ?>
                    <i class="fa fa-pencil-square-o" aria-hidden="true"></i>
                    <i class="fa fa-trash" aria-hidden="true"></i>
                </td>
            </tr>
<?      }
    } else {
?>
    No team members yet.
<?
    } 
?>
        </tbody>
    </table>
</div>
<div class="row">
    <div class="col-md-6">
        <form action="action.invite.php" method="POST">
        <div class="form-group">
            <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
            <input type="email" class="form-control" id="email_address" name="email_address" placeholder="Email address">
            <input type="submit" class="btn btn-primary" value="Invite Team Member">
        </div>                 
        </form>
    </div>
</div>