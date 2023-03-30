<?
    use PHPMailer\PHPMailer\PHPMailer;
	use PHPMailer\PHPMailer\Exception;

    // Load Composer's autoloader
	require 'vendor/autoload.php';
	
	include_once './inc/controller/brand_check.php';

    function sendEmail($emailAddresses, $subject, $body) {
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
			return false;
		}
		return true;
	}
?>