CREATE TABLE `project_update_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectUpdateId` int NOT NULL,
	`storageKey` text NOT NULL,
	`imageUrl` text NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120),
	`fileSizeBytes` int,
	`caption` varchar(500),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_update_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `project_update_images_update_order_idx` ON `project_update_images` (`projectUpdateId`,`sortOrder`);