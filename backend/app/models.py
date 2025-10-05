from pydantic import BaseModel
from typing import List
from datetime import datetime




# Just for practice

class Frontend(BaseModel):
    subject: str
    concepts: List[str]
    music_genre: str
    notes: str

class Gemini(BaseModel):
    string: str



class Blank(BaseModel):
    line_index: int
    answer: str

class ParsedLyrics(BaseModel):
    lyrics: List[str]
    practiced_lyrics: List[str]
    blanks: List[Blank]

class ElevenUrl(BaseModel):
    url: str

class Session(BaseModel):
    session_id: str
    subject: str  # Added missing field
    concepts: List[str]
    music_genre: str
    notes: str  # Added missing field
    lyrics: List[str]
    practiced_lyrics: List[str]
    blanks: List[Blank]
    audio_url: str
    created_at: datetime
    updated_at: datetime

    