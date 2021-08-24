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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
