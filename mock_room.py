from datetime import datetime, timezone
import re
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from database.db import get_db
from model import Submission
from pydantic import BaseModel, Field
from pymysql.cursors import DictCursor
from database.queries import build_groups, get_mastery_rows
from coach import run_coach
from model import Submission, DrillSubmission
from fastapi import Depends
from auth import current_user, hash_pw, check_pw, make_token
from model import Submission, DrillSubmission, SignupIn, LoginIn


app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True}


class ScholarshipChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None


@app.post("/scholarships/chat")
async def scholarship_chat(body: ScholarshipChatIn, uid: str = Depends(current_user)):
    message = body.message.strip()
    if not message:
        raise HTTPException(400, "Enter a message.")
    session_id = body.session_id
    if not session_id or not re.fullmatch(r"[A-Za-z0-9_-]{8,64}", session_id):
        session_id = uuid.uuid4().hex
    try:
        from scholarship_agent import answer_scholarship_question

        reply = await answer_scholarship_question(message, f"{uid}:{session_id}")
    except Exception as error:
        print("Scholarship assistant failed:", repr(error))
        raise HTTPException(503, "The scholarship assistant could not answer right now. Please try again.")
    return {"reply": reply, "session_id": session_id}


@app.post("/auth/signup")
def signup(body: SignupIn):
    email = body.email.strip().lower()
    if "@" not in email or len(body.password) < 8:
        raise HTTPException(400, "Enter a valid email and a password of at least 8 characters")
    name = (body.name or email.split("@")[0]).strip()[:100]
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                raise HTTPException(409, "This email is already registered")
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            cur.execute(
                "INSERT INTO users(email, name, password_hash, created_at) VALUES(%s,%s,%s,%s)",
                (email, name, hash_pw(body.password), now))
            user_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    return {"token": make_token(user_id), "name": name}


@app.post("/auth/login")
def login(body: LoginIn):
    email = body.email.strip().lower()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, password_hash FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row or not check_pw(body.password, row[2]):
        raise HTTPException(400, "Wrong email or password")      # 400 on purpose, see Step 7
    return {"token": make_token(row[0]), "name": row[1]}

@app.get("/passages")
def list_passages():
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute("""SELECT p.id, p.title, COUNT(q.id) AS questions
                           FROM passages p JOIN questions q ON q.passage_id = p.id
                           WHERE q.status = 'validated'
                           GROUP BY p.id, p.title ORDER BY p.id""")
            return cur.fetchall()
    finally:
        conn.close()


@app.get("/passages/{pid}")
def get_passage(pid: int):
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute("SELECT id, title, body FROM passages WHERE id = %s", (pid,))
            p = cur.fetchone()
            if not p:
                raise HTTPException(404, "Passage not found")
            cur.execute("""SELECT id, stem, options FROM questions
                           WHERE passage_id = %s AND status = 'validated' ORDER BY id""", (pid,))
            qs = cur.fetchall()
    finally:
        conn.close()
    return {
        "id": p["id"], "title": p["title"], "passage": p["body"],
        "questions": [{"id": q["id"], "stem": q["stem"],
                       "options": json.loads(q["options"])} for q in qs],
    }


@app.post("/passages/{pid}/submit")
def submit(pid: int, sub: Submission, uid: str = Depends(current_user)):
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute("""SELECT id, answer_index, evidence, topic FROM questions
                           WHERE passage_id = %s AND status = 'validated' ORDER BY id""", (pid,))
            qs = cur.fetchall()
            if not qs:
                raise HTTPException(404, "Passage not found")

            results, score = [], 0
            for q in qs:
                correct = sub.answers.get(q["id"]) == q["answer_index"]
                score += correct
                results.append({"id": q["id"], "correct": correct,
                                "answer_index": q["answer_index"], "evidence": q["evidence"]})

            now = datetime.now(timezone.utc).replace(tzinfo=None)
            cur.execute(
                "INSERT INTO attempts(user_id,passage_id,score,total,taken_at) VALUES(%s,%s,%s,%s,%s)",
                (uid, pid, score, len(qs), now))
            attempt_id = cur.lastrowid
            cur.executemany(
                "INSERT INTO answers(attempt_id,question_id,topic,chosen,correct) VALUES(%s,%s,%s,%s,%s)",
                [(attempt_id, q["id"], q["topic"], sub.answers.get(q["id"]), int(r["correct"]))
                 for q, r in zip(qs, results)])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"score": score, "total": len(qs), "results": results}

@app.get("/me/mastery")
def mastery(uid: str = Depends(current_user)):
    return get_mastery_rows(uid)

@app.get("/me/attempts")
def attempts(uid: str = Depends(current_user)):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT passage_id AS set_id, score, total, taken_at, kind, topic FROM attempts
                           WHERE user_id = %s ORDER BY id DESC LIMIT 20""", (uid,))
            rows = cur.fetchall()
    finally:
        conn.close()
    return [
        {"set_id": set_id, "score": score, "total": total,
         "taken_at": taken_at.isoformat() + "Z", "kind": kind, "topic": topic}
        for set_id, score, total, taken_at, kind, topic in rows
    ]


@app.get("/me/practice")
def practice(uid: str = Depends(current_user)):
    try:
        out = run_coach(uid)
        return {"topic": out["topic"], "rationale": out.get("rationale", ""),
                "study_tip": out.get("study_tip", ""), "groups": out["groups"],
                "trace": out.get("trace", [])}
    except Exception as e:
        print("Coach failed, using fallback:", repr(e))
        rows = [m for m in get_mastery_rows(uid) if m["attempted"] >= 3]
        if not rows:
            raise HTTPException(400, "Take at least one full test first")
        topic = rows[0]["topic"]
        groups = build_groups(uid, topic, 8)
        if not groups:
            raise HTTPException(404, "No questions for this topic yet")
        return {"topic": topic, "groups": groups, "trace": [],
                "rationale": f"Your accuracy on {topic} is the lowest, so this drill focuses on it.",
                "study_tip": ""}


class DrillSubmission(BaseModel):
    user_id: str
    topic: str
    question_ids: list[int]
    answers: dict[int, int]


@app.post("/practice/submit")
def submit_drill(sub: DrillSubmission, uid: str = Depends(current_user)):
    if not sub.question_ids:
        raise HTTPException(400, "No questions")
    conn = get_db()
    try:
        with conn.cursor(DictCursor) as cur:
            cur.execute(
                """SELECT id, answer_index, evidence, topic FROM questions
                   WHERE status = 'validated' AND id IN (%s)""" % ",".join(["%s"] * len(sub.question_ids)),
                sub.question_ids)
            qs = cur.fetchall()
            if not qs:
                raise HTTPException(404, "Questions not found")
            results, score = [], 0
            for q in qs:
                correct = sub.answers.get(q["id"]) == q["answer_index"]
                score += correct
                results.append({"id": q["id"], "correct": correct,
                                "answer_index": q["answer_index"], "evidence": q["evidence"]})
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            cur.execute(
                """INSERT INTO attempts(user_id, passage_id, score, total, taken_at, kind, topic)
                   VALUES(%s, NULL, %s, %s, %s, 'drill', %s)""",
                (uid, score, len(qs), now, sub.topic))
            attempt_id = cur.lastrowid
            cur.executemany(
                "INSERT INTO answers(attempt_id,question_id,topic,chosen,correct) VALUES(%s,%s,%s,%s,%s)",
                [(attempt_id, q["id"], q["topic"], sub.answers.get(q["id"]), int(r["correct"]))
                 for q, r in zip(qs, results)])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"score": score, "total": len(qs), "results": results}