import os, datetime
from pathlib import Path
import certifi
import pymysql
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

def get_db():
    kwargs = {}
    if os.getenv("DB_SSL", "0") == "1":
        kwargs["ssl"] = {"ca": certifi.where()}
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "prep"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "prephub"),
        charset="utf8mb4",
        autocommit=False,
        **kwargs,
    )

def init_db():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS passages(
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          body MEDIUMTEXT NOT NULL,
          subject VARCHAR(100),
          created_at DATETIME NOT NULL
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS questions(
          id INT AUTO_INCREMENT PRIMARY KEY,
          passage_id INT NOT NULL,
          stem TEXT NOT NULL,
          options JSON NOT NULL,
          answer_index TINYINT NOT NULL,
          evidence TEXT,
          topic VARCHAR(100) NOT NULL,
          difficulty FLOAT NULL,
          status ENUM('validated','retired') NOT NULL DEFAULT 'validated',
          INDEX idx_topic (topic),
          FOREIGN KEY (passage_id) REFERENCES passages(id)
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS attempts(
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          passage_id INT NULL,
          score INT NOT NULL,
          total INT NOT NULL,
          taken_at DATETIME NOT NULL,
          kind ENUM('passage','drill') NOT NULL DEFAULT 'passage',
          topic VARCHAR(150) NULL,
          INDEX idx_user (user_id)
        )""")
        cur.execute("SHOW COLUMNS FROM attempts")
        attempt_columns = {row[0]: row for row in cur.fetchall()}
        if attempt_columns["passage_id"][2].upper() == "NO":
            cur.execute("ALTER TABLE attempts MODIFY passage_id INT NULL")
        if "kind" not in attempt_columns:
            cur.execute(
                "ALTER TABLE attempts ADD COLUMN kind "
                "ENUM('passage','drill') NOT NULL DEFAULT 'passage'"
            )
        if "topic" not in attempt_columns:
            cur.execute("ALTER TABLE attempts ADD COLUMN topic VARCHAR(150) NULL")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS refill_runs(
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject VARCHAR(150),
        n_generated INT, n_kept INT, was_stored TINYINT,
        bad_options INT, evidence_missing INT, key_mismatch INT,
        unparseable INT, api_error INT, duplicates INT,
        created_at DATETIME)""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS answers(
          attempt_id INT NOT NULL,
          question_id INT NOT NULL,
          topic VARCHAR(100) NOT NULL,
          chosen INT NULL,
          correct TINYINT NOT NULL,
          INDEX idx_attempt (attempt_id),
          FOREIGN KEY (attempt_id) REFERENCES attempts(id),
          FOREIGN KEY (question_id) REFERENCES questions(id)
        )""")
        
    conn.commit()
    conn.close()

init_db()