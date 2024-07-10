<?
    require_once('./inc/model/brand.php');
    require_once('./inc/controller/get-users-list.php');

    $users = getAllActiveUsers($_SESSION['brand_id']);

?>
<h3>Users</h3>
<div class="table-responsive">

    <table class="table">
        <thead>
        <tr><th>Username</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Email address</th>
            <th>Last logged in</th>
            <th>Is administrator</th>
        </thead>
        <tbody>
<?
        foreach ($users as $user) { 
        ?>
            <tr>
                <td><?=$user->username;?></td>
                <td><?=$user->first_name;?></td>
                <td><?=$user->last_name;?></td>
                <td><?=$user->email_address;?></td>
                <td><?=isset($user->last_logged_in)?date_format(date_create($user->last_logged_in),'M d, Y \a\t h:i:sA'):"Never";?></td>
                <td><?=$user->is_admin ? "✔️": "";?></td>
                <td><a href="action.toggle-admin.php?id=<?=$user->id;?>"><?=$user->is_admin?"Remove admin":"Make admin";?></a>
            </tr>
<?
        }
?>
        </tbody>
    </table>
</div>

<div class="row">
    <div class="col-md-6">
        <form action="action.invite-administrator.php" method="POST">
        <div class="form-group">
            <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
            <input type="email" class="form-control" id="email_address" name="email_address" placeholder="Email address">
            <input type="submit" class="btn btn-primary" value="Invite Administrator">
        </div>                 
        </form>
    </div>
</div>