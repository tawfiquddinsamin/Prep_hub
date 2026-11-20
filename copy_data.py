import os
from pathlib import Path

import certifi
import pymysql
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def initialize_schema(connection):
    schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    with connection.cursor() as cursor:
        for statement in schema.split(";"):
            statement = statement.strip()
            if statement:
                cursor.execute(statement)
    connection.commit()


def main():
    local = None
    remote = None
    try:
        local = pymysql.connect(
            host=os.getenv("LOCAL_DB_HOST", "localhost"),
            port=int(os.getenv("LOCAL_DB_PORT", "3306")),
            user=os.getenv("LOCAL_DB_USER") or os.getenv("DB_USER", "prep"),
            password=required_env("LOCAL_DB_PASSWORD"),
            database=os.getenv("LOCAL_DB_NAME", "prephub"),
            charset="utf8mb4",
            autocommit=False,
        )
        database = required_env("DB_NAME")
        remote = pymysql.connect(
            host=required_env("DB_HOST"),
            port=int(os.getenv("REMOTE_DB_PORT", "4000")),
            user=required_env("DB_USER"),
            password=required_env("DB_PASSWORD"),
            charset="utf8mb4",
            ssl={"ca": certifi.where()},
            autocommit=True,
        )

        with remote.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database.replace('`', '``')}` "
                "CHARACTER SET utf8mb4"
            )
        remote.close()
        remote = pymysql.connect(
            host=required_env("DB_HOST"),
            port=int(os.getenv("REMOTE_DB_PORT", "4000")),
            user=required_env("DB_USER"),
            password=required_env("DB_PASSWORD"),
            database=database,
            charset="utf8mb4",
            ssl={"ca": certifi.where()},
            autocommit=False,
        )
        initialize_schema(remote)

        with remote.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM passages")
            if cursor.fetchone()[0] > 0:
                raise SystemExit("Remote already has passages, stopping.")

        with local.cursor() as local_cursor, remote.cursor() as remote_cursor:
            local_cursor.execute(
                "SELECT id, title, body, subject, created_at FROM passages"
            )
            passages = local_cursor.fetchall()
            remote_cursor.executemany(
                """INSERT INTO passages(id, title, body, subject, created_at)
                   VALUES(%s, %s, %s, %s, %s)""",
                passages,
            )

            local_cursor.execute(
                """SELECT id, passage_id, stem, options, answer_index, evidence,
                          topic, difficulty, status FROM questions"""
            )
            questions = local_cursor.fetchall()
            remote_cursor.executemany(
                """INSERT INTO questions(id, passage_id, stem, options, answer_index,
                                          evidence, topic, difficulty, status)
                   VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                questions,
            )

        remote.commit()
        print(f"Copied {len(passages)} passages and {len(questions)} questions.")
    except Exception:
        if remote:
            remote.rollback()
        raise
    finally:
        if local:
            local.close()
        if remote:
            remote.close()


if __name__ == "__main__":
    main()
