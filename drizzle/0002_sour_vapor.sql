CREATE TABLE `project_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`status` enum('submitted','under_review','locked','in_progress','completed','cancelled') NOT NULL,
	`progressPercent` int NOT NULL DEFAULT 0,
	`title` varchar(180) NOT NULL,
	`note` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_device_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`expoPushToken` varchar(255) NOT NULL,
	`platform` enum('ios','android') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_device_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_device_tokens_token_unique` UNIQUE(`expoPushToken`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `progressPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `project_updates_project_created_idx` ON `project_updates` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_device_tokens_user_idx` ON `user_device_tokens` (`userId`);