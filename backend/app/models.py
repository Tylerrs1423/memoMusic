from pydantic import BaseModel, failed
from typing import List
from datetime import datetime




# Just for practice

class Frontend(BaseModel):
    subject: str
    concepts: List[str]
    music_genre: str

class Gemini(BaseModel):
    string: str



class Blank(BaseModel):
    line_index: int
    answer: str

class ParsedLyrics(BaseModel):
    lyrics: List[str]
    practiced_lyrics: List[str]
    blanks: List[Blank]



    