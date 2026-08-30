CREATE TABLE `admin_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` int,
	`summary` varchar(500) NOT NULL,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` int NOT NULL,
	`legalName` varchar(180) NOT NULL,
	`arabicName` varchar(180) NOT NULL,
	`supportEmail` varchar(320) NOT NULL,
	`supportPhone` varchar(32),
	`address` text,
	`website` varchar(300),
	`logoUrl` text,
	`publicTagline` varchar(300) NOT NULL,
	`publicHeroTitle` varchar(300) NOT NULL,
	`publicHeroBody` text,
	`reportFooter` varchar(500) NOT NULL,
	`ownerUserId` int,
	`backupOwnerUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_activity_logs_created_idx` ON `admin_activity_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `admin_activity_logs_actor_idx` ON `admin_activity_logs` (`actorUserId`);