<?
    use PHPMailer\PHPMailer\PHPMailer;
	use PHPMailer\PHPMailer\Exception;

    // Load Composer's autoloader
	require 'vendor/autoload.php';
	
	include_once './inc/controller/brand_check.php';
	include_once './inc/util/MySQLConnection.php';

    function sendEmail($emailAddresses, $subject, $body) {
		$result = true;
		try {
			//PHPMailer Object
			$mail = new PHPMailer(true); //Argument true in constructor enables exceptions
			$mail->isSMTP();
			$mail->Host = SMTP_HOST;
			$mail->SMTPAuth = true;
			$mail->Username = SMTP_USER;
			$mail->Password = SMTP_PASS;
			$mail->Port = SMTP_PORT;

			//From email address and name
			$mail->From = "no-reply@melt-records.com";
			$mail->FromName = $_SESSION['brand_name'];

			//To address and name
			foreach($emailAddresses as $emailAddress) {
				$mail->addAddress($emailAddress, "");
			}

			//Address to which recipient will reply
			$mail->addReplyTo("hi@melt-records.com", "Reply");

			//Send HTML or Plain Text email
			$mail->isHTML(true);

			$mail->Subject = $subject;
			$mail->Body = $body;
			$mail->AltBody = "This is the plain text version of the email content";

			$mail->send();
		} catch (Exception $e) {
			$result = false;
		}

		logEmailAttempt($emailAddresses, $subject, $body, $result);
		return $result;

	}

	function logEmailAttempt($emailAddresses, $subject, $body, $result) {
		$recipients = implode(",", $emailAddresses);
		$sql = "INSERT INTO `email_attempt` (`recipients`, `subject`, `body`, `brand_id`, `result`, `timestamp`) VALUES (".
			"'" . MySQLConnection::escapeString($recipients) . "', " .
			"'" . MySQLConnection::escapeString($subject) . "', " .
			"'" . MySQLConnection::escapeString($body) . "', ".
			"'" . MySQLConnection::escapeString($_SESSION['brand_id']) . "', " .
			"'" . ($result ? "Success":"Failed") . "', NOW())";
		MySQLConnection::query($sql);
	}
?>