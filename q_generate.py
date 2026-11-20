import os

from google import genai
from google.genai import types

from model import ReadingSet

from model import ReadingSet

api_key = (
    os.getenv("GEMMINI_API_KEY")
)

client = genai.Client(api_key=api_key)
MODEL = "gemini-3.5-flash-lite"   # use whichever Flash model your free tier offers

def generate_set(subject: str) -> ReadingSet:
    prompt = f"""Write an original IELTS Academic Reading passage (about 700 words) on: {subject}.
Then write 10 multiple-choice questions with 4 options each.
Mix question topics: main idea, detail, inference, vocabulary in context.
Exactly one option must be correct. For each question, copy the supporting
sentence from the passage into 'evidence' word for word."""
    resp = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ReadingSet,
        ),
    )
    return resp.parsed