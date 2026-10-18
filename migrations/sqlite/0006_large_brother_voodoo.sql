CREATE TABLE `auth_failures` (
	`ip` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
