CREATE TABLE `pull_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` text NOT NULL,
	`at` integer NOT NULL,
	`status` text NOT NULL,
	`ip` text,
	`country` text,
	`region` text,
	`city` text,
	`asn` integer,
	`as_org` text,
	`colo` text,
	`client` text NOT NULL,
	`user_agent` text
);
--> statement-breakpoint
CREATE INDEX `pull_logs_sub_idx` ON `pull_logs` (`subscription_id`,`id`);--> statement-breakpoint
CREATE INDEX `pull_logs_at_idx` ON `pull_logs` (`at`);--> statement-breakpoint
CREATE TABLE `retired_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`retired_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `retired_tokens_sub_idx` ON `retired_tokens` (`subscription_id`);