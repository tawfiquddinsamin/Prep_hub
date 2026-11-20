import os
import threading
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from database.queries import get_mastery_rows, recent_mistakes, bank_stats, build_groups
import refill


def uid_of(config: RunnableConfig) -> str:
    return config["configurable"]["user_id"]      # set by the server, never by the model


@tool
def get_mastery(config: RunnableConfig) -> list:
    """Per-topic accuracy for the student: topic, attempted, accuracy (0-1)."""
    return get_mastery_rows(uid_of(config))


@tool
def get_recent_mistakes(config: RunnableConfig) -> list:
    """The student's most recent wrong answers with topic, question stem and evidence."""
    return recent_mistakes(uid_of(config), 10)


@tool
def check_bank(config: RunnableConfig) -> list:
    """Number of validated questions per topic, and how many the student has not seen."""
    return bank_stats(uid_of(config))


@tool
def request_new_passage(subject: str) -> str:
    """Start generating a new passage in the background when a topic is running low.
    It will NOT be ready for this drill, only for later ones."""
    threading.Thread(target=refill.run, args=([subject], 5), daemon=True).start()
    return f"Generation started for '{subject}'."


@tool
def build_drill(topics: list[str], count: int, config: RunnableConfig) -> str:
    """Pick the final drill. Pass 1-2 topics and a total question count (6-10)."""
    uid = uid_of(config)
    per = max(1, count // len(topics))
    merged = {}
    for t in topics:
        for g in build_groups(uid, t, per):
            if g["passage_id"] in merged:
                merged[g["passage_id"]]["questions"] += g["questions"]
            else:
                merged[g["passage_id"]] = g
    out = config["configurable"]["out"]
    out["groups"] = list(merged.values())
    out["topic"] = " + ".join(topics)
    n = sum(len(g["questions"]) for g in out["groups"])
    return f"Drill built with {n} questions."


@tool
def submit_plan(rationale: str, study_tip: str, config: RunnableConfig) -> str:
    """Final step. Give a 2-3 sentence rationale for the student and one study tip."""
    config["configurable"]["out"].update(rationale=rationale, study_tip=study_tip)
    return "Done."


SYSTEM = """You are an IELTS Reading coach. Goal: design the best next practice drill for this student.
Steps: look at mastery and recent mistakes, decide which topic(s) to drill, check the question bank
(if the chosen topic has fewer than 4 unseen questions, also call request_new_passage with a fresh subject),
call build_drill, then call submit_plan with a short, specific rationale that references the student's
actual numbers or mistakes. Be encouraging and concrete. Never invent data; only use tool results."""

api_key = (
    os.getenv("GOOGLE_API_KEY")
    or os.getenv("GEMINI_API_KEY")
    or os.getenv("GEMMINI_API_KEY")
)
llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite", temperature=0.2, api_key=api_key
)
agent = create_react_agent(
    llm,
    [get_mastery, get_recent_mistakes, check_bank,
     request_new_passage, build_drill, submit_plan],
    prompt=SYSTEM)


def run_coach(uid: str) -> dict:
    out = {}
    res = agent.invoke(
        {"messages": [("user", "Design my next drill.")]},
        config={"configurable": {"user_id": uid, "out": out}, "recursion_limit": 12})
    trace = []
    for m in res["messages"]:
        for call in getattr(m, "tool_calls", None) or []:
            trace.append({"tool": call["name"], "args": call["args"]})
    out["trace"] = trace
    if not out.get("groups"):
        raise RuntimeError("Coach did not produce a drill")
    return out