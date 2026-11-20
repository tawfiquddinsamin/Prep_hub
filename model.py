from pydantic import BaseModel

from typing import Literal

class Question(BaseModel):
    id: int
    stem: str
    options: list[str]
    answer_index: int
    topic: Literal["urban beekeeping", "the history of tidal energy", "memory and sleep","FIFA World Cup history", "the psychology of color", "the evolution of jazz music", "the science of dreams", "the impact of social media on society", "the future of renewable energy", "the art of storytelling"]
    evidence: str

class ReadingSet(BaseModel):
    title: str
    passage: str
    questions: list[Question]

class Submission(BaseModel):
    answers: dict[int, int]

class DrillSubmission(BaseModel):
    topic: str
    question_ids: list[int]
    answers: dict[int, int]

class SignupIn(BaseModel):
    email: str
    password: str
    name: str | None = None

class LoginIn(BaseModel):
    email: str
    password: str