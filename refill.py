from database.db import get_db
from model import Question, ReadingSet
from q_generate import MODEL, generate_set
from q_generate import MODEL, client
import argparse, json, time, datetime, difflib
from collections import Counter

def now_utc():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

def setup_log_table():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS refill_runs(
          id INT AUTO_INCREMENT PRIMARY KEY,
          subject VARCHAR(150), n_generated INT, n_kept INT, was_stored TINYINT,
          bad_options INT, evidence_missing INT, key_mismatch INT,
          unparseable INT, api_error INT, duplicates INT,
          created_at DATETIME)""")
    conn.commit(); conn.close()

def call_with_retry(fn, *args, tries=4):
    for i in range(tries):
        try:
            return fn(*args)
        except Exception as e:                    # rate limits, timeouts
            wait = 5 * 2 ** i
            print(f"  API error: {e}. Retrying in {wait}s")
            time.sleep(wait)
    return None

def solve_blind(rs, q):
    opts = "\n".join(f"{i}. {o}" for i, o in enumerate(q.options))
    p = (f"Passage:\n{rs.passage}\n\nQuestion: {q.stem}\n{opts}\n\n"
         "Reply with only the number of the correct option.")
    r = client.models.generate_content(model=MODEL, contents=p)
    try:
        return int(r.text.strip()[0])
    except (ValueError, IndexError):
        return -1

def validate_detailed(rs):
    good, drops = [], Counter()
    for q in rs.questions:
        if len(q.options) != 4 or not 0 <= q.answer_index <= 3:
            drops["bad_options"] += 1; continue
        if q.evidence not in rs.passage:
            drops["evidence_missing"] += 1; continue
        pred = call_with_retry(solve_blind, rs, q)
        if pred is None:
            drops["api_error"] += 1; continue
        if pred == -1:
            drops["unparseable"] += 1; continue
        if pred != q.answer_index:
            drops["key_mismatch"] += 1; continue
        good.append(q)
    return good, drops

def is_duplicate(stem, existing):
    s = stem.lower().strip()
    return any(difflib.SequenceMatcher(None, s, e).ratio() > 0.85 for e in existing)

def store(conn, rs, subject, questions):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO passages(title, body, subject, created_at) VALUES(%s,%s,%s,%s)",
                    (rs.title, rs.passage, subject, now_utc()))
        pid = cur.lastrowid
        cur.executemany(
            """INSERT INTO questions(passage_id, stem, options, answer_index, evidence, topic)
               VALUES(%s,%s,%s,%s,%s,%s)""",
            [(pid, q.stem, json.dumps(q.options), q.answer_index, q.evidence, q.topic)
             for q in questions])
    conn.commit()
    return pid

def log_run(conn, subject, generated, kept, stored, drops):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO refill_runs(subject, n_generated, n_kept, was_stored, bad_options,
               evidence_missing, key_mismatch, unparseable, api_error, duplicates, created_at)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (subject, generated, kept, int(stored), drops["bad_options"],
             drops["evidence_missing"], drops["key_mismatch"], drops["unparseable"],
             drops["api_error"], drops["duplicate"], now_utc()))
    conn.commit()

def run(subjects, min_keep):
    setup_log_table()
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT LOWER(subject) FROM passages")
        seen = {r[0] for r in cur.fetchall()}
        cur.execute("SELECT LOWER(stem) FROM questions")
        stems = [r[0] for r in cur.fetchall()]

    for subject in subjects:
        print(f"\n== {subject}")
        if subject.lower() in seen:
            print("  already in bank, skipping"); continue
        rs = call_with_retry(generate_set, subject)
        if rs is None:
            print("  generation failed, skipping"); continue

        good, drops = validate_detailed(rs)
        fresh = []
        for q in good:
            if is_duplicate(q.stem, stems):
                drops["duplicate"] += 1
            else:
                fresh.append(q)

        stored = len(fresh) >= min_keep
        if stored:
            pid = store(conn, rs, subject, fresh)
            stems.extend(q.stem.lower() for q in fresh)
            seen.add(subject.lower())
            print(f"  stored passage {pid} with {len(fresh)} questions")
        else:
            print(f"  only {len(fresh)} usable questions, not stored")
        print(f"  generated={len(rs.questions)} dropped={dict(drops)}")
        log_run(conn, subject, len(rs.questions), len(fresh), stored, drops)
        time.sleep(2)                              # be gentle with the free tier
    conn.close()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--subjects", required=True, help="comma-separated list")
    ap.add_argument("--min-keep", type=int, default=5)
    a = ap.parse_args()
    run([s.strip() for s in a.subjects.split(",") if s.strip()], a.min_keep)