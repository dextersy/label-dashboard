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
