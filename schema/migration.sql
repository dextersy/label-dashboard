-- Updated August 17, 2021
ALTER TABLE `recuperable_expense` ADD `date_recorded` DATE NULL DEFAULT '2021-08-17' AFTER `expense_amount`;
ALTER TABLE `recuperable_expense` CHANGE `date_recorded` `date_recorded` DATE NULL DEFAULT NULL;

-- Uploaded August 23, 2021
ALTER TABLE `artist` 
DROP COLUMN `starting_balance`,
ADD COLUMN `profile_photo` VARCHAR(255) NULL AFTER `website_page_url`;
ALTER TABLE `release` 
ADD COLUMN `cover_art` VARCHAR(255) NULL AFTER `status`;

--- Updated August 24, 2021
CREATE TABLE `artist_image` (
  `id` int NOT NULL AUTO_INCREMENT,
  `path` varchar(255) NOT NULL,
  `credits` varchar(1024) DEFAULT NULL,
  `artist_id` int NOT NULL,
  `date_uploaded` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_artist_image_artist_id_idx` (`artist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--- Updated August 25, 2021
CREATE TABLE `artist_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) DEFAULT NULL,
  `path` varchar(255) NOT NULL,
  `date_uploaded` date DEFAULT NULL,
  `artist_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_artist_documents_artist_id_idx` (`artist_id`),
  CONSTRAINT `fk_artist_documents_artist_id` FOREIGN KEY (`artist_id`) REFERENCES `artist` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4;

--- Updated September 21, 2021
ALTER TABLE `artist` 
CHANGE COLUMN `bio` `bio` VARCHAR(4096) NULL DEFAULT NULL ;

--- Updated December 6, 2021
CREATE TABLE `brand` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `brand_name` VARCHAR(255) NOT NULL,
  `logo_url` VARCHAR(255) NULL,
  `brand_color` VARCHAR(45) NOT NULL DEFAULT '#ffffff',
  PRIMARY KEY (`id`));
CREATE TABLE `domain` (
  `brand_id` INT NOT NULL,
  `domain_name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`brand_id`, `domain_name`),
  CONSTRAINT `fk_domain_brand`
    FOREIGN KEY (`brand_id`)
    REFERENCES `brand` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);
INSERT INTO `brand` (`brand_name`, `logo_url`) VALUES ('Melt Records', 'assets/img/Melt Records-logo-WHITE.png');
ALTER TABLE `artist` 
ADD COLUMN `brand_id` INT NOT NULL DEFAULT 1 AFTER `profile_photo`;
ALTER TABLE `artist` 
ADD CONSTRAINT `fk_artist_brand`
  FOREIGN KEY (`brand_id`)
  REFERENCES `brand` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;


ALTER TABLE `brand` 
CHANGE COLUMN `brand_color` `brand_color` ENUM('blue', 'azure', 'green', 'orange', 'red', 'purple') NOT NULL DEFAULT 'blue' ;
ALTER TABLE `domain` 
ADD COLUMN `status` ENUM('Verified', 'Unverified', 'Pending') NULL DEFAULT 'Unverified' AFTER `domain_name`;


ALTER TABLE `user` 
ADD COLUMN `brand_id` INT NOT NULL DEFAULT 1 AFTER `is_admin`;
ALTER TABLE `user` 
ADD CONSTRAINT `fk_user_brand`
  FOREIGN KEY (`brand_id`)
  REFERENCES `brand` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE `user` 
ADD COLUMN `reset_hash` VARCHAR(255) NULL AFTER `brand_id`;


----- NEW
ALTER TABLE `domain` 
ADD UNIQUE INDEX `domain_name_UNIQUE` (`domain_name` ASC) VISIBLE;
;

-----
ALTER TABLE `brand` 
ADD COLUMN `brand_website` VARCHAR(45) NULL AFTER `brand_color`;

---- 09-29-2022
CREATE TABLE `payment_method` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `artist_id` INT NOT NULL,
  `type` VARCHAR(45) NOT NULL,
  `account_name` VARCHAR(45) NOT NULL,
  `account_number_or_email` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_payment_methods_artist_id_idx` (`artist_id` ASC),
  CONSTRAINT `fk_payment_methods_artist_id`
    FOREIGN KEY (`artist_id`)
    REFERENCES `artist` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);
ALTER TABLE `payment_method` 
ADD COLUMN `is_default_for_artist` TINYINT NOT NULL DEFAULT 0 AFTER `account_number_or_email`;

--- 09-30-2022
ALTER TABLE `payment` 
ADD COLUMN `paid_thru_type` VARCHAR(45) NULL AFTER `date_paid`,
ADD COLUMN `paid_thru_account_name` VARCHAR(45) NULL AFTER `paid_thru_type`,
ADD COLUMN `paid_thru_account_number` VARCHAR(45) NULL AFTER `paid_thru_account_name`;

--- 03-29-2023
CREATE TABLE `new_table` (
  `brand_id` INT NOT NULL,
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `date_and_time` DATETIME NOT NULL,
  `venue` VARCHAR(255) NOT NULL,
  `description` VARCHAR(1024) NULL,
  `poster_url` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `event_id_UNIQUE` (`id` ASC) VISIBLE);
ALTER TABLE `new_table` 
ADD INDEX `fk_brand_idx` (`brand_id` ASC) VISIBLE;
;
ALTER TABLE `new_table` 
ADD CONSTRAINT `fk_brand`
  FOREIGN KEY (`brand_id`)
  REFERENCES `brand` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
ALTER TABLE `new_table` 
RENAME TO  `event` ;

CREATE TABLE `ticket` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email_address` VARCHAR(255) NOT NULL,
  `contact_number` VARCHAR(45) NULL,
  `number_of_entries` INT NOT NULL DEFAULT 1,
  `ticket_code` VARCHAR(5) NOT NULL,
  `status` ENUM('New', 'Payment Confirmed', 'Ticket sent.') NOT NULL DEFAULT 'New',
  PRIMARY KEY (`id`));

ALTER TABLE `ticket` 
ADD INDEX `fk_event_idx` (`event_id` ASC) VISIBLE;
;
ALTER TABLE `ticket` 
ADD CONSTRAINT `fk_event`
  FOREIGN KEY (`event_id`)
  REFERENCES `event` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

---- 03/31
ALTER TABLE `event` 
ADD COLUMN `rsvp_link` VARCHAR(255) NULL AFTER `poster_url`;
ALTER TABLE `event` 
ADD COLUMN `ticket_price` DECIMAL NOT NULL AFTER `rsvp_link`;

---- 04/01
ALTER TABLE `ticket` 
ADD COLUMN `payment_link` VARCHAR(255) NULL AFTER `status`,
ADD COLUMN `payment_link_id` VARCHAR(45) NULL AFTER `payment_link`;


--- 07/31
ALTER TABLE `artist` 
ADD COLUMN `tiktok_handle` VARCHAR(45) NULL AFTER `brand_id`,
ADD COLUMN `band_members` VARCHAR(4096) NULL AFTER `tiktok_handle`,
ADD COLUMN `youtube_channel` VARCHAR(255) NULL AFTER `band_members`;

--- 10/09
ALTER TABLE `ticket` 
CHANGE COLUMN `status` `status` ENUM('New', 'Payment Confirmed', 'Ticket sent.', 'Canceled') NOT NULL DEFAULT 'New' ;

--- 01/09/2024
ALTER TABLE `brand` 
ADD COLUMN `release_submission_url` VARCHAR(1024) NULL AFTER `brand_website`,
ADD COLUMN `catalog_prefix` VARCHAR(5) NULL AFTER `release_submission_url`;

ALTER TABLE `release` 
ADD COLUMN `brand_id` INT NOT NULL DEFAULT 1 AFTER `cover_art`,
ADD INDEX `fk_brand_id_idx` (`brand_id` ASC) VISIBLE;
;
ALTER TABLE `release` 
ADD CONSTRAINT `fk_brand_id`
  FOREIGN KEY (`brand_id`)
  REFERENCES `brand` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

-- 01/27/2024
ALTER TABLE `brand` 
ADD COLUMN `parent_brand` INT NULL DEFAULT NULL AFTER `catalog_prefix`,
ADD INDEX `fk_brand_parent_brand_idx` (`parent_brand` ASC) VISIBLE;
;
ALTER TABLE `brand` 
ADD CONSTRAINT `fk_brand_parent_brand`
  FOREIGN KEY (`parent_brand`)
  REFERENCES `brand` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

-- 01/27/2024
ALTER TABLE `ticket` 
ADD COLUMN `price_per_ticket` DECIMAL(10,2) NULL DEFAULT NULL AFTER `payment_link_id`,
ADD COLUMN `payment_processing_fee` DECIMAL(10,2) NULL DEFAULT NULL AFTER `price_per_ticket`;

-- 01/29/2024
ALTER TABLE `user` 
ADD COLUMN `last_logged_in` DATETIME NULL DEFAULT NULL AFTER `reset_hash`;

--- 04/10/2024
ALTER TABLE `recuperable_expense` 
ADD COLUMN `brand_id` INT NOT NULL DEFAULT 1 AFTER `date_recorded`,
ADD INDEX `fk_recuperable_expense_brand_idx` (`brand_id` ASC) VISIBLE;
;
ALTER TABLE `recuperable_expense` 
ADD CONSTRAINT `fk_recuperable_expense_brand`
  FOREIGN KEY (`brand_id`)
  REFERENCES `brand` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

--- 04/29
ALTER TABLE `artist` 
DROP INDEX `name_UNIQUE` ;
;

--- 04/30
CREATE TABLE `login_attempt` (
  `id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `status` ENUM('Successful', 'Failed') NOT NULL,
  `date_and_time` DATETIME NOT NULL,
  `brand_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_login_attempt_1_idx` (`brand_id` ASC) VISIBLE,
  INDEX `fk_login_attempt_2_idx` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_login_attempt_1`
    FOREIGN KEY (`brand_id`)
    REFERENCES `brand` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_login_attempt_2`
    FOREIGN KEY (`user_id`)
    REFERENCES `user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);
ALTER TABLE `login_attempt` 
CHANGE COLUMN `id` `id` INT NOT NULL AUTO_INCREMENT ;

--- 07/10
CREATE TABLE `event_referrer` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NOT NULL,
  `referral_code` VARCHAR(45) NOT NULL,
  `event_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `fk_event_referrer_event_id_idx` (`event_id` ASC) VISIBLE,
  CONSTRAINT `fk_event_referrer_event_id`
    FOREIGN KEY (`event_id`)
    REFERENCES `event` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION);

ALTER TABLE `ticket` 
ADD COLUMN `referrer_id` INT NULL AFTER `payment_processing_fee`,
ADD INDEX `fk_ticket_referrer_idx` (`referrer_id` ASC) VISIBLE;
;

ALTER TABLE `ticket` 
ADD CONSTRAINT `fk_ticket_referrer`
  FOREIGN KEY (`referrer_id`)
  REFERENCES `event_referrer` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

ALTER TABLE `event_referrer` 
ADD UNIQUE INDEX `referral_code_UNIQUE` (`referral_code` ASC) VISIBLE;
;

--- JULY 31, 2024
ALTER TABLE `event` 
ADD COLUMN `buy_shortlink` VARCHAR(1024) NULL DEFAULT NULL AFTER `ticket_price`;
ALTER TABLE `event_referrer` 
ADD COLUMN `referral_shortlink` VARCHAR(1024) NULL DEFAULT NULL AFTER `event_id`;

--- AUG 1, 2024
ALTER TABLE `login_attempt` 
ADD COLUMN `proxy_ip` VARCHAR(45) NULL DEFAULT NULL AFTER `brand_id`,
ADD COLUMN `remote_ip` VARCHAR(45) NULL DEFAULT NULL AFTER `proxy_ip`;

--- AUG 9, 2024
ALTER TABLE `event` 
ADD COLUMN `close_time` DATETIME NULL DEFAULT NULL AFTER `buy_shortlink`;


--- AUG 16, 2024
ALTER TABLE `artist` 
ADD COLUMN `payout_point` INT NOT NULL DEFAULT 1000 AFTER `youtube_channel`;

--- AUG 26, 2024
ALTER TABLE `brand` 
ADD COLUMN `paymongo_wallet_id` VARCHAR(255) NULL DEFAULT NULL AFTER `parent_brand`;
ALTER TABLE `payment_method` 
ADD COLUMN `bank_code` VARCHAR(45) NOT NULL DEFAULT 'N/A' AFTER `is_default_for_artist`;

--- AUG 26, 2024
ALTER TABLE `payment` 
ADD COLUMN `payment_method_id` INT NULL DEFAULT NULL AFTER `paid_thru_account_number`,
ADD COLUMN `reference_number` VARCHAR(45) NULL DEFAULT NULL AFTER `payment_method_id`,
ADD INDEX `fk_payment_payment_method_idx` (`payment_method_id` ASC) VISIBLE;
;
ALTER TABLE `payment` 
ADD CONSTRAINT `fk_payment_payment_method`
  FOREIGN KEY (`payment_method_id`)
  REFERENCES `payment_method` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

--- SEP 7, 2024
CREATE TABLE `email_attempt` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipients` VARCHAR(1024) NOT NULL,
  `subject` VARCHAR(1024) NOT NULL,
  `body` LONGTEXT NOT NULL,
  `timestamp` DATETIME NOT NULL,
  PRIMARY KEY (`id`));
ALTER TABLE `email_attempt` 
ADD COLUMN `result` VARCHAR(45) NOT NULL AFTER `timestamp`;


ALTER TABLE `ticket` 
ADD COLUMN `order_timestamp` DATETIME NULL DEFAULT NULL AFTER `referrer_id`;

---- SEP 9, 2024
ALTER TABLE `ticket` 
ADD COLUMN `checkout_key` VARCHAR(255) NULL DEFAULT NULL AFTER `order_timestamp`;
ALTER TABLE `ticket` 
ADD INDEX `checkout_key` (`checkout_key` ASC) VISIBLE;
ALTER TABLE `ticket` 
ADD INDEX `payment_link_id` (`payment_link_id` ASC) VISIBLE;

---- SEP 10, 2024
ALTER TABLE `brand` 
ADD COLUMN `payment_processing_fee_for_payouts` VARCHAR(45) NOT NULL DEFAULT '10' AFTER `paymongo_wallet_id`;
ALTER TABLE `payment` 
ADD COLUMN `payment_processing_fee` DECIMAL NOT NULL DEFAULT 0 AFTER `reference_number`;
ALTER TABLE `payment` 
CHANGE COLUMN `payment_processing_fee` `payment_processing_fee` DECIMAL(10,2) NOT NULL DEFAULT '0' ;

ALTER TABLE `release_artist` 
CHANGE COLUMN `streaming_royalty_percentage` `streaming_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT '0.500' ,
CHANGE COLUMN `sync_royalty_percentage` `sync_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT '0.500' ;
ALTER TABLE `release_artist` 
CHANGE COLUMN `download_royalty_percentage` `download_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT '0.500' ,
CHANGE COLUMN `physical_royalty_percentage` `physical_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT '0.200' ;

--- SEPT 22, 2024
ALTER TABLE `ticket` 
ADD COLUMN `number_of_claimed_entries` VARCHAR(45) NOT NULL DEFAULT 0 AFTER `checkout_key`;
ALTER TABLE `brand` 
ADD COLUMN `favicon_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `payment_processing_fee_for_payouts`;

---
ALTER TABLE `event` 
ADD COLUMN `verification_pin` VARCHAR(6) NOT NULL AFTER `close_time`;
ALTER TABLE `event` 
ADD COLUMN `verification_link` VARCHAR(1024) NOT NULL AFTER `verification_pin`;
