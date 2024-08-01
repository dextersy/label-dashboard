<?
    require_once('./inc/model/brand.php');
    require_once('./inc/controller/get-users-list.php');
    require_once('./inc/controller/get-login-attempts.php');

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

<?
    define('LOGIN_ATTEMPT_LIST_LIMIT', 30);
    $login_attempts = getRecentLoginAttempts($_SESSION['brand_id'], LOGIN_ATTEMPT_LIST_LIMIT); 
?>
<h3>Recent Login Attempts</h3>
<div class="table-responsive">

    <table class="table">
        <thead>
        <tr><th>Username</th>
            <th>Name</th>
            <th>Time</th>
            <th>Result</th>
            <th>Remote IP</th>
            <th>Proxy IP</th>
        </thead>
        <tbody>
<?
        foreach ($login_attempts as $login_attempt) { 
        ?>
            <tr>
                <td><?=$login_attempt->username;?></td>
                <td><?=$login_attempt->name;?></td>
                <td><?=date_format(date_create($login_attempt->date_and_time),'M d, Y \a\t h:i:sA');?></td>
                <td><?=$login_attempt->result;?></td>
                <td><?=$login_attempt->remote_ip;?></td>
                <td><?=$login_attempt->proxy_ip;?></td>
            </tr>
<?
        }
?>
        </tbody>
    </table>
</div>