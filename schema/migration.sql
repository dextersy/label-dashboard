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
