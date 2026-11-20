CREATE TABLE IF NOT EXISTS users(
  id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(100), password_hash VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL);

CREATE TABLE IF NOT EXISTS passages(
  id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL,
  body MEDIUMTEXT NOT NULL, subject VARCHAR(100), created_at DATETIME NOT NULL);

CREATE TABLE IF NOT EXISTS questions(
  id INT AUTO_INCREMENT PRIMARY KEY, passage_id INT NOT NULL,
  stem TEXT NOT NULL, options JSON NOT NULL, answer_index TINYINT NOT NULL,
  evidence TEXT, topic VARCHAR(100) NOT NULL, difficulty FLOAT NULL,
  status ENUM('validated','retired') NOT NULL DEFAULT 'validated',
  INDEX idx_topic (topic), FOREIGN KEY (passage_id) REFERENCES passages(id));

CREATE TABLE IF NOT EXISTS attempts(
  id INT AUTO_INCREMENT PRIMARY KEY, user_id VARCHAR(64) NOT NULL,
  passage_id INT NULL, score INT NOT NULL, total INT NOT NULL, taken_at DATETIME NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'mock', topic VARCHAR(100) NULL,
  INDEX idx_user (user_id));

CREATE TABLE IF NOT EXISTS answers(
  attempt_id INT NOT NULL, question_id INT NOT NULL, topic VARCHAR(100) NOT NULL,
  chosen INT NULL, correct TINYINT NOT NULL, INDEX idx_attempt (attempt_id),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id),
  FOREIGN KEY (question_id) REFERENCES questions(id));

CREATE TABLE IF NOT EXISTS refill_runs(
  id INT AUTO_INCREMENT PRIMARY KEY, subject VARCHAR(150),
  n_generated INT, n_kept INT, was_stored TINYINT,
  bad_options INT, evidence_missing INT, key_mismatch INT,
  unparseable INT, api_error INT, duplicates INT, created_at DATETIME);
