import json
import random
from pymysql.cursors import DictCursor
from database.db import get_db


def get_mastery_rows(uid: str):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT a.topic, COUNT(*), SUM(a.correct)
                FROM answers a JOIN attempts t ON t.id = a.attempt_id
                WHERE t.user_id = %s GROUP BY a.topic""", (uid,))
            rows = cur.fetchall()
    finally:
        conn.close()
    return sorted(
        [{"topic": t, "attempted": int(n), "accuracy": round(float(c) / int(n), 2)}
         for t, n, c in rows],
        key=lambda x: x["accuracy"])

def build_groups(uid: str, topic: str, count: int):
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute("""
                SELECT q.id, q.passage_id, q.stem, q.options,
                  EXISTS(SELECT 1 FROM answers a JOIN attempts t ON t.id = a.attempt_id
                         WHERE a.question_id = q.id AND t.user_id = %s) AS seen
                FROM questions q
                WHERE q.topic = %s AND q.status = 'validated'""", (uid, topic))
            rows = cur.fetchall()
            if not rows:
                return []
            random.shuffle(rows)
            rows.sort(key=lambda r: r["seen"])
            chosen = rows[:count]
            pids = sorted({r["passage_id"] for r in chosen})
            cur.execute(
                "SELECT id, title, body FROM passages WHERE id IN (%s)" % ",".join(["%s"] * len(pids)),
                pids)
            passages = {p["id"]: p for p in cur.fetchall()}
    finally:
        conn.close()
    groups = []
    for pid in pids:
        qs = [r for r in chosen if r["passage_id"] == pid]
        groups.append({
            "passage_id": pid, "title": passages[pid]["title"], "passage": passages[pid]["body"],
            "questions": [{"id": r["id"], "stem": r["stem"],
                           "options": json.loads(r["options"])} for r in qs]})
    return groups


def recent_mistakes(uid: str, limit: int = 10):
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute("""
                SELECT q.id, q.topic, q.stem, q.evidence
                FROM answers a
                JOIN attempts t ON t.id = a.attempt_id
                JOIN questions q ON q.id = a.question_id
                WHERE t.user_id = %s AND a.correct = 0
                ORDER BY t.id DESC LIMIT %s""", (uid, limit))
            return cur.fetchall()
    finally:
        conn.close()


def bank_stats(uid: str):
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute("""
                SELECT q.topic, COUNT(*) AS total,
                  SUM(NOT EXISTS(SELECT 1 FROM answers a JOIN attempts t ON t.id = a.attempt_id
                                 WHERE a.question_id = q.id AND t.user_id = %s)) AS unseen
                FROM questions q WHERE q.status = 'validated' GROUP BY q.topic""", (uid,))
            return [{"topic": r["topic"], "total": int(r["total"]), "unseen": int(r["unseen"])}
                    for r in cur.fetchall()]
    finally:
        conn.close()