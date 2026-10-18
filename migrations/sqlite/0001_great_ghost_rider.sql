CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`mode` text NOT NULL,
	`config` text NOT NULL,
	`nodes` text DEFAULT '[]' NOT NULL,
	`node_count` integer DEFAULT 0 NOT NULL,
	`userinfo` text,
	`auto_update_interval` integer,
	`last_refreshed_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_token_unique` ON `subscriptions` (`token`);