-- ==========================================================================
-- NetWatch NOC Monitoring System - Database Schema Setup
-- Compatible with MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- ==========================================================================

-- 1. Create Database
CREATE DATABASE IF NOT EXISTS netwatch_noc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE netwatch_noc;

-- 2. DEVICES TABLE
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL UNIQUE,          -- Supports IPv4 and IPv6
    device_type VARCHAR(50) NOT NULL,                -- Router, Switch, Server, Firewall, AP
    location VARCHAR(100) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Online',     -- Online, Offline, Warning
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_status (status)
) ENGINE=InnoDB;

-- 3. MONITORING LOGS TABLE (Telemetry History)
CREATE TABLE IF NOT EXISTS monitoring_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    ping_ms FLOAT DEFAULT NULL,                      -- NULL when status is 'offline'
    status VARCHAR(20) NOT NULL,                     -- online, offline, warning
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logs_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_logs_device_time (device_id, checked_at DESC)
) ENGINE=InnoDB;

-- 4. ALERTS TABLE (Alarms Incident History)
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    message TEXT NOT NULL,
    alert_type VARCHAR(20) NOT NULL,                  -- critical, warning, resolved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alerts_device FOREIGN KEY (device_id) 
        REFERENCES devices(id) ON DELETE CASCADE,
    INDEX idx_alerts_device_time (device_id, created_at DESC)
) ENGINE=InnoDB;

-- 5. USERS TABLE (Operator Authentication)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,                   -- Hashed password (e.g. bcrypt/argon2)
    role VARCHAR(20) NOT NULL DEFAULT 'Operator',      -- Admin, Operator
    INDEX idx_users_username (username)
) ENGINE=InnoDB;


-- ==========================================================================
-- SEED DATA SETUP (Starter Mock Data matching NetWatch Dashboard UI)
-- ==========================================================================

-- Seed default Admin and Operator accounts
-- Default credentials: admin / admin (Password hashed using bcrypt)
INSERT INTO users (username, password, role) VALUES 
('admin', '$2a$12$L8qMvT26L3iV9mJ9cKbUle7i0uO7yT6kX9qX6mO6eL6mF6yO6b6kC', 'Admin'),
('operator01', '$2a$12$K8qMvT26L3iV9mJ9cKbUle7i0uO7yT6kX9qX6mO6eL6mF6yO6b6kC', 'Operator')
ON DUPLICATE KEY UPDATE username=username;

-- Seed default monitored hardware nodes
INSERT INTO devices (id, device_name, ip_address, device_type, location, status) VALUES
(1, 'Router-Core-01', '192.168.1.1', 'Router', 'NOC Rack A1', 'Online'),
(2, 'Database-Server-Main', '192.168.1.10', 'Server', 'NOC Rack B3', 'Offline'),
(3, 'Core-Switch-A', '192.168.1.2', 'Core Switch', 'NOC Rack A2', 'Offline'),
(4, 'Firewall-Border-Edge', '192.168.1.254', 'Firewall', 'Border Perimeter', 'Warning'),
(5, 'Wireless-AP-Zone21', '192.168.1.21', 'Access Point', 'Building C Floor 2', 'Online')
ON DUPLICATE KEY UPDATE ip_address=ip_address;

-- Seed default telemetry history
INSERT INTO monitoring_logs (device_id, ping_ms, status) VALUES
(1, 2.3, 'online'),
(2, NULL, 'offline'),
(3, NULL, 'offline'),
(4, 82.5, 'warning'),
(5, 9.1, 'online');

-- Seed default incident alerts
INSERT INTO alerts (device_id, message, alert_type) VALUES
(2, 'Database-Server-Main timed out. DB replicas out of sync.', 'critical'),
(3, 'Core-Switch-A down. Critical loop detected in backplane fiber.', 'critical'),
(4, 'Firewall-Border-Edge round-trip high: 82ms (limit 45ms). High packet processing load.', 'warning');
