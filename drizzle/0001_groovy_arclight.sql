CREATE TABLE `catalog_nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`parentId` int,
	`nodeType` enum('category','option') NOT NULL DEFAULT 'category',
	`name` varchar(180) NOT NULL,
	`description` text,
	`imageUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(180),
	`phone` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_profiles_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`altText` varchar(240),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`catalogNodeId` int NOT NULL,
	`name` varchar(220) NOT NULL,
	`description` text,
	`productCode` varchar(120),
	`mainImageUrl` text,
	`customerPrice` decimal(12,2),
	`internalCostPrice` decimal(12,2),
	`isAvailable` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_code_unique` UNIQUE(`productCode`)
);
--> statement-breakpoint
CREATE TABLE `project_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`storageKey` text NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120),
	`fileSizeBytes` int,
	`uploadStatus` enum('pending','uploaded','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`projectServiceId` int NOT NULL,
	`productId` int,
	`catalogNodeId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_selections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`serviceId` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_services_project_service_unique` UNIQUE(`projectId`,`serviceId`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`propertyType` varchar(80),
	`city` varchar(100),
	`address` text,
	`areaSqm` decimal(10,2),
	`notes` text,
	`status` enum('draft','submitted','under_review','locked','in_progress','completed','cancelled') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`lockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` text,
	`imageUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `catalog_nodes_service_parent_order_idx` ON `catalog_nodes` (`serviceId`,`parentId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `catalog_nodes_active_idx` ON `catalog_nodes` (`isActive`);--> statement-breakpoint
CREATE INDEX `product_images_product_order_idx` ON `product_images` (`productId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `products_catalog_active_order_idx` ON `products` (`catalogNodeId`,`isActive`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `products_service_idx` ON `products` (`serviceId`);--> statement-breakpoint
CREATE INDEX `project_attachments_project_idx` ON `project_attachments` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_attachments_user_idx` ON `project_attachments` (`userId`);--> statement-breakpoint
CREATE INDEX `project_selections_project_service_idx` ON `project_selections` (`projectId`,`projectServiceId`);--> statement-breakpoint
CREATE INDEX `project_services_project_idx` ON `project_services` (`projectId`);--> statement-breakpoint
CREATE INDEX `projects_user_status_updated_idx` ON `projects` (`userId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `services_active_order_idx` ON `services` (`isActive`,`sortOrder`);