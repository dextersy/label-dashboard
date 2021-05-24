<?php

include_once('./inc/config.php');

class MySQLConnection {
    private static $conn = null;

    public static function connect() {
        if (self::$conn == null) {
            self::$conn = new mysqli(DB_SERVER, DB_USER, DB_PASSWORD, DB_DATABASE);
            if (self::$conn->connect_error) {
                die("Connection failed: " . self::$conn->connect_error);
            }
        }
    }

    public static function query($sql) {
        if (self::$conn == null) {
            MySQLConnection::connect();
        }
        return self::$conn->query($sql);
    }
}

?>