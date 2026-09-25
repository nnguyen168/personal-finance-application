ALTER TABLE `categories` ADD `icon` text;
--> statement-breakpoint
-- Built-in categories use their slug as icon key.
UPDATE `categories` SET `icon` = `slug` WHERE `slug` IS NOT NULL;
