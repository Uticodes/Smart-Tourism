-- Crowdsourced Smart Tourism Recommendation and Navigation System
-- Database schema (MySQL 8.0) — eight tables, Section 3.6 of the project report.
-- Additions beyond Chapter 3 are marked [CHANGE n] and listed in the build plan
-- ("Small changes to Chapter 3 found while planning").

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Report_Verifications;
DROP TABLE IF EXISTS Site_Reports;
DROP TABLE IF EXISTS Search_Logs;
DROP TABLE IF EXISTS Reviews;
DROP TABLE IF EXISTS Attractions;
DROP TABLE IF EXISTS User_Preferences;
DROP TABLE IF EXISTS Categories;
DROP TABLE IF EXISTS Users;
SET FOREIGN_KEY_CHECKS = 1;

-- Table 3.6
CREATE TABLE Users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  display_name   VARCHAR(50)  NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('tourist','admin') NOT NULL DEFAULT 'tourist',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3.8
CREATE TABLE Categories (
  category_id    INT AUTO_INCREMENT PRIMARY KEY,
  category_name  VARCHAR(80)  NOT NULL UNIQUE,
  description    VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3.7
CREATE TABLE User_Preferences (
  pref_id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  category_id      INT NOT NULL,
  priority_weight  TINYINT NULL,
  UNIQUE KEY uq_user_category (user_id, category_id),
  CONSTRAINT fk_pref_user     FOREIGN KEY (user_id)     REFERENCES Users(user_id)          ON DELETE CASCADE,
  CONSTRAINT fk_pref_category FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3.12 (created before Attractions because Attractions.report_id references it)
CREATE TABLE Site_Reports (
  report_id              INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id            INT NOT NULL,
  category_id            INT NOT NULL,
  site_name              VARCHAR(150) NOT NULL,
  local_name             VARCHAR(150) NULL,
  description            TEXT NOT NULL,
  latitude               DECIMAL(9,6) NOT NULL,
  longitude              DECIMAL(9,6) NOT NULL,
  access_notes           VARCHAR(500) NULL,
  photo_urls             JSON NOT NULL,
  public_access          BOOLEAN NOT NULL,
  status                 ENUM('pending','under_review','needs_info','approved','rejected') NOT NULL DEFAULT 'pending', -- [CHANGE 2] needs_info
  confirm_count          INT NOT NULL DEFAULT 0,
  flag_count             INT NOT NULL DEFAULT 0,
  is_hidden              BOOLEAN NOT NULL DEFAULT FALSE, -- [CHANGE 3]
  nearest_attraction_id  INT NULL,
  nearest_report_id      INT NULL,                       -- [CHANGE 4]
  nearest_distance_m     DECIMAL(8,1) NULL,
  reviewed_by            INT NULL,
  review_note            VARCHAR(255) NULL,
  submitted_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at            DATETIME NULL,
  KEY idx_reports_location (latitude, longitude),
  KEY idx_reports_status (status),
  CONSTRAINT fk_report_reporter  FOREIGN KEY (reporter_id)       REFERENCES Users(user_id),
  CONSTRAINT fk_report_category  FOREIGN KEY (category_id)       REFERENCES Categories(category_id),
  CONSTRAINT fk_report_reviewer  FOREIGN KEY (reviewed_by)       REFERENCES Users(user_id),
  CONSTRAINT fk_report_nearest_r FOREIGN KEY (nearest_report_id) REFERENCES Site_Reports(report_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3.9
CREATE TABLE Attractions (
  attraction_id  INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  category_id    INT NOT NULL,
  description    TEXT NULL,
  latitude       DECIMAL(9,6) NOT NULL,
  longitude      DECIMAL(9,6) NOT NULL,
  address        VARCHAR(255) NULL,
  avg_rating     DECIMAL(2,1) NULL,
  image_url      VARCHAR(255) NULL,
  source         ENUM('curated','community') NOT NULL DEFAULT 'curated',
  report_id      INT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attractions_location (latitude, longitude),
  KEY idx_attractions_status (status),
  CONSTRAINT fk_attraction_category FOREIGN KEY (category_id) REFERENCES Categories(category_id),
  CONSTRAINT fk_attraction_report   FOREIGN KEY (report_id)   REFERENCES Site_Reports(report_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE Site_Reports
  ADD CONSTRAINT fk_report_nearest_a FOREIGN KEY (nearest_attraction_id) REFERENCES Attractions(attraction_id) ON DELETE SET NULL;

-- Table 3.10
CREATE TABLE Reviews (
  review_id      INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  attraction_id  INT NOT NULL,
  rating         TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_user_attraction (user_id, attraction_id), -- [CHANGE 5]
  CONSTRAINT fk_review_user       FOREIGN KEY (user_id)       REFERENCES Users(user_id)             ON DELETE CASCADE,
  CONSTRAINT fk_review_attraction FOREIGN KEY (attraction_id) REFERENCES Attractions(attraction_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3.11
CREATE TABLE Search_Logs (
  log_id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id                 INT NULL,
  query_text              VARCHAR(150) NULL,
  latitude                DECIMAL(9,6) NOT NULL,
  longitude               DECIMAL(9,6) NOT NULL,
  selected_attraction_id  INT NULL,      -- [CHANGE 1] for MRR
  selected_rank           SMALLINT NULL, -- [CHANGE 1] for MRR
  searched_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_search_time (searched_at),
  CONSTRAINT fk_search_user      FOREIGN KEY (user_id)                REFERENCES Users(user_id)             ON DELETE SET NULL,
  CONSTRAINT fk_search_selection FOREIGN KEY (selected_attraction_id) REFERENCES Attractions(attraction_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3.13
CREATE TABLE Report_Verifications (
  verification_id  INT AUTO_INCREMENT PRIMARY KEY,
  report_id        INT NOT NULL,
  user_id          INT NOT NULL,
  response         ENUM('confirm','flag') NOT NULL,
  reason           VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_response (report_id, user_id),
  CONSTRAINT fk_verif_report FOREIGN KEY (report_id) REFERENCES Site_Reports(report_id) ON DELETE CASCADE,
  CONSTRAINT fk_verif_user   FOREIGN KEY (user_id)   REFERENCES Users(user_id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
