import json, datetime
from mock_room import get_db

def import_sets(path="sets.json"):
    sets = json.load(open(path))
    conn = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM passages")
            if cur.fetchone()[0] > 0:
                print("Passages already exist, skipping import.")
                return
            for s in sets:
                cur.execute(
                    "INSERT INTO passages(title, body, subject, created_at) VALUES(%s,%s,%s,%s)",
                    (s["title"], s["passage"], s["title"], now))
                pid = cur.lastrowid
                for q in s["questions"]:
                    cur.execute(
                        """INSERT INTO questions
                           (passage_id, stem, options, answer_index, evidence, topic)
                           VALUES(%s,%s,%s,%s,%s,%s)""",
                        (pid, q["stem"], json.dumps(q["options"]),
                         q["answer_index"], q["evidence"], q["topic"].lower().strip()))
        conn.commit()
        print(f"Imported {len(sets)} passages.")
    finally:
        conn.close()

if __name__ == "__main__":
    import_sets()