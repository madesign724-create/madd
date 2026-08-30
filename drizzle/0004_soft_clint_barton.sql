CREATE TABLE `staff_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(180),
	`role` enum('owner','catalog_manager','project_manager','viewer') NOT NULL DEFAULT 'viewer',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_members_email_unique` UNIQUE(`email`),
	CONSTRAINT `staff_members_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `staff_members_role_active_idx` ON `staff_members` (`role`,`isActive`);