<?
    require_once('./inc/model/brand.php');
    require_once('./inc/controller/users-controller.php');
    require_once('./inc/controller/get-login-attempts.php');

    $users = getAllActiveUsers($_SESSION['brand_id']);
?>
<h3>Users</h3>
<div class="table-responsive">

    <table class="table" id="tblUsers">
        <thead>
        <tr><th>Username</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Email address</th>
            <th>Last logged in</th>
            <th>Is administrator</th>
            <th></th>
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
    define('LOGIN_ATTEMPT_LIST_LIMIT', 300);
    $login_attempts = getRecentLoginAttempts($_SESSION['brand_id'], LOGIN_ATTEMPT_LIST_LIMIT); 
?>

<div class="col-md-6">
<h3>Recent Login Attempts</h3>
<div class="table-responsive">

    <table class="table" id="tblLoginAttempts">
        <thead>
        <tr><th>Username</th>
            <th>Name</th>
            <th>Time</th>
            <th>Result</th>
            <th>Remote IP</th>
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
            </tr>
<?
        }
?>
        </tbody>
    </table>
</div>
</div>
<script src="/assets/js/jquery.3.2.1.min.js"></script>
<script src="/assets/js/fancyTable.min.js"></script>
<script type="text/javascript">
$("#tblUsers").fancyTable({
  sortColumn:0, // column number for initial sorting
  sortOrder: 'ascending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
  paginationClass:"btn-link",
  paginationClassActive:"active",
  pageClosest: 3,
  perPage: 10,
  sortable: true,
  pagination: true, // default: false
  searchable: true,
  globalSearch: true,
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;"
});

$("#tblLoginAttempts").fancyTable({
  sortColumn:2, // column number for initial sorting
  sortOrder: 'descending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
  paginationClass:"btn-link",
  paginationClassActive:"active",
  pageClosest: 3,
  perPage: 10,
  sortable: true,
  pagination: true, // default: false
  searchable: true,
  globalSearch: true,
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;"
});
</script>