ALTER TABLE `projects` ADD `assignedStaffId` int;--> statement-breakpoint
CREATE INDEX `projects_assigned_staff_idx` ON `projects` (`assignedStaffId`);