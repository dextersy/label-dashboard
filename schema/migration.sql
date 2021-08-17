-- Updated August 17, 2021
ALTER TABLE `recuperable_expense` ADD `date_recorded` DATE NULL DEFAULT '2021-08-17' AFTER `expense_amount`;
ALTER TABLE `recuperable_expense` CHANGE `date_recorded` `date_recorded` DATE NULL DEFAULT NULL;
