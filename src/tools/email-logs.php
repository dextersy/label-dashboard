
<?
    chdir('../');
    include_once('./util/MySQLConnection.php');

    include_once('./inc/controller/brand_check.php');
    include_once('./inc/controller/access_check.php');

    if($isAdmin) {
        $limit = isset($_GET['count']) ? $_GET['count'] : '20';

        $query = "SELECT * FROM `email_attempt` WHERE `brand_id` = '" . $_SESSION['brand_id'] . "' ORDER BY `timestamp` DESC ";

        if($limit != null) {
            $query = $query . "LIMIT 0, " . $limit . " "; 
        }
?>
<table>
    <throw><th>Time</th><th>Recipients</th><th>Subject</th><th>Status</th></throw>

<?
        $result = MySQLConnection::query($query);
        while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
?>
    <tr>
        <td style="border: 1px solid black;"><?=$row['timestamp'];?></td>
        <td style="border: 1px solid black;"><?=$row['recipients'];?></td>
        <td style="border: 1px solid black;"><?=$row['subject'];?></td>
        <td style="border: 1px solid black;"><?=$row['result'];?></td>
    </tr>
<?
        }
?>
</table>
<?
    } else {
?>
Sorry, you don't have access to this resource.
<?
    }
?>