-- ═══════════════════════════════════════════════════════════════════════════
--  SOCIETY ERP — COMPLETE DATABASE SETUP
--  Database: u709643491_society_erp
--
--  HOW TO USE THIS FILE:
--  1. Open phpMyAdmin on Hostinger
--  2. Select database: u709643491_society_erp
--  3. Click SQL tab → paste this entire file → click Go
-- ═══════════════════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: societies
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `societies` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(150) NOT NULL,
  `address`    TEXT,
  `city`       VARCHAR(100),
  `state`      VARCHAR(100),
  `pincode`    VARCHAR(10),
  `status`     ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: flats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `flats` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `society_id`  INT          NOT NULL,
  `wing`        VARCHAR(10),
  `flat_number` VARCHAR(20)  NOT NULL,
  `floor`       INT,
  `owner_name`  VARCHAR(150),
  `status`      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_flat_society` (`society_id`),
  CONSTRAINT `fk_flat_society` FOREIGN KEY (`society_id`) REFERENCES `societies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: users
--  ⚠️  Passwords are stored as bcrypt hashes — NEVER plain text.
--  To generate a hash: node utils/hashPassword.js yourpassword
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `society_id`  INT          NOT NULL,
  `flat_id`     INT                   DEFAULT NULL,  -- NULL for CHAIRMAN, SECURITY
  `role`        ENUM('CHAIRMAN','RESIDENT','SECURITY') NOT NULL,
  `name`        VARCHAR(150) NOT NULL,
  `username`    VARCHAR(100) NOT NULL,
  `password`    VARCHAR(255) NOT NULL,               -- bcrypt hash
  `mobile`      VARCHAR(15)           DEFAULT NULL,
  `email`       VARCHAR(150)          DEFAULT NULL,
  `status`      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `fk_user_society` (`society_id`),
  KEY `fk_user_flat`    (`flat_id`),
  CONSTRAINT `fk_user_society` FOREIGN KEY (`society_id`) REFERENCES `societies` (`id`),
  CONSTRAINT `fk_user_flat`    FOREIGN KEY (`flat_id`)    REFERENCES `flats`     (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: visitors
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `visitors` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `flat_id`        INT          NOT NULL,
  `visitor_name`   VARCHAR(150) NOT NULL,
  `mobile`         VARCHAR(15)           DEFAULT NULL,
  `purpose`        VARCHAR(200)          DEFAULT NULL,
  `vehicle_number` VARCHAR(20)           DEFAULT NULL,
  `status`         ENUM('IN','OUT')      NOT NULL DEFAULT 'IN',
  `entry_time`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `exit_time`      DATETIME              DEFAULT NULL,
  `security_id`    INT                   DEFAULT NULL,
  `approved_by`    INT                   DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_visitor_flat`     (`flat_id`),
  KEY `fk_visitor_security` (`security_id`),
  KEY `fk_visitor_approved` (`approved_by`),
  CONSTRAINT `fk_visitor_flat`     FOREIGN KEY (`flat_id`)     REFERENCES `flats` (`id`),
  CONSTRAINT `fk_visitor_security` FOREIGN KEY (`security_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_visitor_approved` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: maintenance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `maintenance` (
  `id`         INT            NOT NULL AUTO_INCREMENT,
  `flat_id`    INT            NOT NULL,
  `month`      TINYINT        NOT NULL COMMENT '1=Jan … 12=Dec',
  `year`       SMALLINT       NOT NULL,
  `amount`     DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  `paid`       DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  `status`     ENUM('PENDING','PARTIAL','PAID') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flat_month_year` (`flat_id`, `month`, `year`),
  KEY `fk_maint_flat` (`flat_id`),
  CONSTRAINT `fk_maint_flat` FOREIGN KEY (`flat_id`) REFERENCES `flats` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: complaints
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `complaints` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `flat_id`     INT          NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `description` TEXT                  DEFAULT NULL,
  `status`      ENUM('PENDING','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'PENDING',
  `created_by`  INT                   DEFAULT NULL,
  `assigned_to` INT                   DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_complaint_flat`   (`flat_id`),
  KEY `fk_complaint_creator` (`created_by`),
  KEY `fk_complaint_assign`  (`assigned_to`),
  CONSTRAINT `fk_complaint_flat`    FOREIGN KEY (`flat_id`)     REFERENCES `flats` (`id`),
  CONSTRAINT `fk_complaint_creator` FOREIGN KEY (`created_by`)  REFERENCES `users` (`id`),
  CONSTRAINT `fk_complaint_assign`  FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ─────────────────────────────────────────────────────────────────────────────
--  TABLE: amenities
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `amenities` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(150)  NOT NULL,
  `price`      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status`     ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ═══════════════════════════════════════════════════════════════════════════
--  SEED DATA — SAMPLE SOCIETY
-- ═══════════════════════════════════════════════════════════════════════════

-- Society
INSERT INTO `societies` (`id`, `name`, `address`, `city`, `state`, `pincode`) VALUES
(1, 'Green Valley Residency', 'Plot No. 42, SG Highway', 'Ahmedabad', 'Gujarat', '380054');

-- Flats
INSERT INTO `flats` (`id`, `society_id`, `wing`, `flat_number`, `floor`, `owner_name`) VALUES
(1,  1, 'A', '101', 1, 'Rajesh Shah'),
(2,  1, 'A', '102', 1, 'Neha Patel'),
(3,  1, 'A', '103', 1, 'Imran Khan'),
(4,  1, 'A', '201', 2, 'Priya Mehta'),
(5,  1, 'B', '101', 1, 'Arjun Desai'),
(6,  1, 'B', '102', 1, 'Sana Ali');

-- Amenities
INSERT INTO `amenities` (`name`, `price`, `status`) VALUES
('Clubhouse',       500.00, 'ACTIVE'),
('Swimming Pool',   200.00, 'ACTIVE'),
('Gym',             150.00, 'ACTIVE'),
('Badminton Court', 100.00, 'ACTIVE'),
('Party Hall',     1000.00, 'ACTIVE');


-- ═══════════════════════════════════════════════════════════════════════════
--  USERS WITH HASHED PASSWORDS
--
--  IMPORTANT: The hashes below are bcrypt of these passwords:
--    chairman  →  Chairman@2025
--    guard01   →  Guard@2025
--    resident1 →  Resident@2025
--
--  ⚠️  CHANGE THESE PASSWORDS after first login is set up.
--
--  To generate a new hash for any password:
--    1. Open terminal in society_backend folder
--    2. Run: node utils/hashPassword.js YourNewPassword
--    3. Copy the hash
--    4. Run this SQL to update:
--       UPDATE users SET password = 'PASTE_HASH_HERE' WHERE username = 'chairman';
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO `users` (`society_id`, `flat_id`, `role`, `name`, `username`, `password`, `mobile`, `status`) VALUES

-- CHAIRMAN  (password: Chairman@2025)
(1, NULL, 'CHAIRMAN', 'Ramesh Sharma', 'chairman',
 '$2a$12$l880iy/5dp6OPwvCYbKQzeXZ9CaqH7bK5SSl.SSYOd.7gq7bQvitC',
 '9876543210', 'ACTIVE'),

-- SECURITY GUARD  (password: Guard@2025)
(1, NULL, 'SECURITY', 'Suresh Guard', 'guard01',
 '$2a$12$jLz/guKXtKOkQzHVi4AkUenatrBq6hSpgxW3WSGmsiPOW1u6L77Eu',
 '9988776655', 'ACTIVE'),

-- RESIDENTS  (password: Resident@2025)
(1, 1, 'RESIDENT', 'Rajesh Shah',  'resident_a101',
 '$2a$12$QBnJUOfg5zBVrSkb2vq1FeuPh3BLX9LbbuB8KMQfpo4HbbC/K2WWO',
 '9111111101', 'ACTIVE'),

(1, 2, 'RESIDENT', 'Neha Patel',   'resident_a102',
 '$2a$12$QBnJUOfg5zBVrSkb2vq1FeuPh3BLX9LbbuB8KMQfpo4HbbC/K2WWO',
 '9111111102', 'ACTIVE'),

(1, 5, 'RESIDENT', 'Arjun Desai',  'resident_b101',
 '$2a$12$QBnJUOfg5zBVrSkb2vq1FeuPh3BLX9LbbuB8KMQfpo4HbbC/K2WWO',
 '9111111105', 'ACTIVE');


SET FOREIGN_KEY_CHECKS = 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅  SETUP COMPLETE
-- Tables created: societies, flats, users, visitors, maintenance, complaints, amenities
-- Sample data inserted for Green Valley Residency
-- ═══════════════════════════════════════════════════════════════════════════
