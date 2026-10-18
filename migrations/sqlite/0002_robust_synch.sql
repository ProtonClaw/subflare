CREATE TABLE `pull_stats` (
	`subscription_id` text NOT NULL,
	`day` text NOT NULL,
	`client` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`subscription_id`, `day`, `client`)
);
--> statement-breakpoint
CREATE INDEX `pull_stats_day_idx` ON `pull_stats` (`day`);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `last_pulled_at` integer;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `last_client` text;