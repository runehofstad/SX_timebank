-- Timebank System Database Schema
-- This represents the Firestore collections structure in SQL format for reference

-- Users Collection
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'project_manager', 'developer') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Clients Collection
CREATE TABLE clients (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Timebanks Collection
CREATE TABLE timebanks (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    total_hours DECIMAL(10,2) NOT NULL,
    used_hours DECIMAL(10,2) DEFAULT 0,
    remaining_hours DECIMAL(10,2) NOT NULL,
    status ENUM('active', 'depleted', 'expired') DEFAULT 'active',
    purchase_date DATE NOT NULL,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Projects Collection
CREATE TABLE projects (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('active', 'completed', 'on_hold', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Project Team Members (Subcollection in Firestore)
CREATE TABLE project_team_members (
    project_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Time Entries Collection
CREATE TABLE time_entries (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    timebank_id VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    hours DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (timebank_id) REFERENCES timebanks(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Email Notifications Collection
CREATE TABLE email_notifications (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    timebank_id VARCHAR(255) NOT NULL,
    type ENUM('low_hours', 'depleted', 'expiring_soon') NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_to JSON NOT NULL, -- Array of email addresses
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (timebank_id) REFERENCES timebanks(id)
);

-- Indexes for performance
CREATE INDEX idx_timebanks_client ON timebanks(client_id);
CREATE INDEX idx_timebanks_status ON timebanks(status);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_timebank ON time_entries(timebank_id);
CREATE INDEX idx_time_entries_status ON time_entries(status);
CREATE INDEX idx_time_entries_date ON time_entries(date);

-- Firestore Collection Structure:
-- /users/{userId}
-- /clients/{clientId}
-- /timebanks/{timebankId}
-- /projects/{projectId}
-- /projects/{projectId}/teamMembers/{userId}
-- /timeEntries/{entryId}
-- /emailNotifications/{notificationId}