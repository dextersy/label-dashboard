<?php

include_once('./inc/config.php');

class MySQLConnection {
    private static $conn = null;
    public static $lastInsertID = 0;

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
            self::connect();
        }
        try {
            $result = self::$conn->query($sql);
            self::$lastInsertID = self::$conn->insert_id;
            return $result;
        }
        catch (Exception $e) {
            return null; // TODO Maybe better to do specific error handling here
        }
    }

    public static function escapeString($string) {
        if (self::$conn == null) {
            self::connect();
        }
        return self::$conn->real_escape_string($string);
    }
}

?>