from pydantic import BaseModel
from typing import List
from datetime import datetime




# Just for practice

class Frontend(BaseModel):
    subject: str
    concepts: List[str]
    music_genre: str
    notes: str
    grade_level: str = "high school"

class Gemini(BaseModel):
    string: str



class Blank(BaseModel):
    line_index: int
    word_position: int  # Position of the blank word in the line
    original_word: str  # The word that should be filled in
    start_time: float = 0.0  # Start time in seconds for this word
    end_time: float = 0.0  # End time in seconds for this word
    is_correct: bool = False  # Whether user has answered correctly
    user_answer: str = ""  # User's current answer

class ParsedLyrics(BaseModel):
    lyrics: List[str]
    practiced_lyrics: List[str]
    blanks: List[Blank]

class ElevenUrl(BaseModel):
    url: str

class Session(BaseModel):
    session_id: str
    subject: str
    concepts: List[str]
    music_genre: str
    notes: str
    lyrics: List[str]
    practiced_lyrics: List[str]
    blanks: List[Blank]
    audio_data: bytes  # Store audio data directly
    created_at: datetime
    updated_at: datetime

    