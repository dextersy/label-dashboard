<?
include('./vendor/phpqrcode.php');
QRcode::png('code data text', 'tmp/qrcode/filename.png');
?>