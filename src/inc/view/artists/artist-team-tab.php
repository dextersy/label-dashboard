<?
    include_once('./inc/controller/get_team_members.php');

    include_once('./inc/controller/brand_check.php');

    $userAccessRights = getTeamMembersForArtist($_SESSION['current_artist']);

    function getUserStatusString($status) {
        if ( $status == "Pending" ) {
            $class = 'badge-secondary';
        }
        else if ($status == "Accepted") {
            $class = 'badge-success';
        }
        return "<span class=\"badge " . $class . "\">" . $status . "</span>";
    }
?>
<div class="card">
    <div class="card-header"><h4 class="title">Team Members</h3></div>
        <div class="card-body">
            <div class="table-responsive">
            <table class="table">
                <thead>
                    <tr><th>Name</th>
                    <th>Email address</th>
                    <!--
                    <th>Artist Access</th>
                    <th>Financial Access</th>
                    -->
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
                        <!--<td>Read</td>
                        <td>Read</td>-->
                        <td><?=getUserStatusString($user->status); ?>
                        <?php if ($user->status == 'Pending') { ?>
                            <form action="action.invite.php" method="POST">
                                <input type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
                                <input type="hidden" name="email_address" value="<?=$user->email_address;?>">
                                <input type="hidden" name="invite_hash" value="<?=$user->invite_hash;?>">
                                <input type="submit" class="btn-link" value="[Resend invite]">
                            </form>
                        <?php } ?>
                        </td>
                        <td>
                        <a href="action.remove-team-member.php?artist=<?=$_SESSION['current_artist'];?>&user=<?=$user->user_id;?>">
                            <i class="fa fa-trash" aria-hidden="true"></i>
                        </a>
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
            <hr>
            <div class="col-md-4">
                <h5>Invite team members</h5>
                <form action="action.invite.php" method="POST">
                <div class="form-group">
                    <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
                    <div class="input-group">
                        <input type="email" class="form-control" id="email_address" name="email_address" placeholder="Email address">
                        <div class="input-group-btn">
                            <input type="submit" class="btn btn-primary" value="Send Invite">
                        </div>
                    </div>
                </div>                 
                </form>
            </div>
        </div>
    </div>
</div>
