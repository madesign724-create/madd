CREATE TABLE `report_email_schedules` (
	`scheduleKey` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`isEnabled` boolean NOT NULL DEFAULT false,
	`recipient` varchar(320) NOT NULL,
	`lastSentPeriod` varchar(7),
	`lastSentAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_email_schedules_scheduleKey` PRIMARY KEY(`scheduleKey`),
	CONSTRAINT `report_email_schedules_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE INDEX `report_email_schedules_enabled_idx` ON `report_email_schedules` (`isEnabled`);