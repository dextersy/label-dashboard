<?
    chdir("../..");
    include_once("./inc/model/user.php");
    
    if($_SERVER['REQUEST_METHOD'] == 'POST') {

        $username = $_POST['username'];
        $brand_id = $_POST['brand_id'];

        $user = new User;
        if($user->fromUsername($brand_id, $username)) {
            echo '{ "result": "true" }';
        }
        else {
            echo '{ "result": "false" }';
        }        
    }
?>