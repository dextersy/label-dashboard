-- Updated August 17, 2021
ALTER TABLE `recuperable_expense` ADD `date_recorded` DATE NULL DEFAULT '2021-08-17' AFTER `expense_amount`;
ALTER TABLE `recuperable_expense` CHANGE `date_recorded` `date_recorded` DATE NULL DEFAULT NULL;

-- Uploaded August 23, 2021
ALTER TABLE `artist` 
DROP COLUMN `starting_balance`,
ADD COLUMN `profile_photo` VARCHAR(255) NULL AFTER `website_page_url`;
ALTER TABLE `release` 
ADD COLUMN `cover_art` VARCHAR(255) NULL AFTER `status`;
