import google.genai as genai
import requests
import json
from backend.app.config import GEMINI_API_KEY, ELEVENLABS_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

def generate_content(prompt: str):
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    return response.text

def generate_lyrics(subject: str, concepts: list, music_genre: str, grade_level: str = "high school") -> list:
    """Generate educational lyrics using Gemini AI"""
    concepts_text = ', '.join(concepts) if concepts else ""
    
    prompt = f"""
Subject: {subject}
Key Concepts: {concepts_text if concepts_text else f"(If blank, select the 4–6 most essential facts, formulas, or definitions about {subject}.)"}
Intended Audience: {grade_level}
Musical Genre/Style: {music_genre or "any appropriate style"}

Instructions:
If no key concepts are provided, select the 4–6 most fundamental facts, formulas, or definitions every {grade_level} student must know about {subject}.
Write exactly 8 lyric lines, each clearly stating one key concept—what it is, what it does, or its formula—in plain, natural English.
Use rhyme (AABB or ABAB), repetition, and vivid imagery to make lyrics catchy and memorable.
STRICTLY AVOID all mathematical symbols or shorthand, including integral signs, multiplication dots, variable abbreviations like "udv" or "vdu," and any other notation.
Fully spell out all calculus operations, formulas, and expressions in clear spoken English. For example, use "the integral of u with respect to v" instead of any symbols or shorthand.
Match the rhythm and mood of the selected genre or style.
Use language appropriate for {grade_level} learners.

CRITICAL: Return ONLY a JSON array of 8 strings. No explanations, no formatting, no extra text.
Format: ["lyric line 1", "lyric line 2", "lyric line 3", "lyric line 4", "lyric line 5", "lyric line 6", "lyric line 7", "lyric line 8"]
"""
    
    lyrics_text = generate_content(prompt)
    
    # Clean up the response and split into lines
    lines = lyrics_text.strip().split('\n')
    cleaned_lyrics = []
    
    for line in lines:
        line = line.strip()
        # Skip markdown formatting, line numbers, and empty lines
        if (line and 
            not line.startswith(('```', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')) and
            not line.startswith('[') and 
            not line.startswith(']') and
            line != ','):
            
            # Remove ALL quotes, escaped quotes, brackets, and trailing commas - be aggressive
            line = line.replace('\\"', '').replace("\\'", '').replace('"', '').replace("'", '').replace('[', '').replace(']', '').strip(',').strip()
            if line and len(line) > 3:  # Only keep substantial lines
                cleaned_lyrics.append(line)
    
    # Return exactly 8 lines, pad with empty strings if needed
    while len(cleaned_lyrics) < 8:
        cleaned_lyrics.append("")
    
    return cleaned_lyrics[:8]

def create_composition_plan(lyrics: list, music_genre: str = "pop") -> dict:
    """Create ElevenLabs composition plan"""
    url = "https://api.elevenlabs.io/v1/music/plan"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "prompt": f"Educational {music_genre} song with 8 lyric lines",
        "music_length_ms": 48000
    }
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    plan = response.json()

    # Inject exact lyrics into the first section
    if plan.get("sections"):
        plan["sections"][0]["lines"] = lyrics
        plan["sections"][0]["positive_local_styles"] = [music_genre]
        plan["sections"][0]["duration_ms"] = 48000

    return plan

def compose_music(composition_plan: dict) -> bytes:
    """Generate music from composition plan"""
    url = "https://api.elevenlabs.io/v1/music"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "composition_plan": composition_plan,
        "output_format": "mp3_44100_128",
        "respect_sections_durations": True
    }
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    return response.content

def generate_educational_song(subject: str, concepts: list, music_genre: str = "pop", grade_level: str = "high school") -> dict:
    """Complete pipeline: generate lyrics and compose music"""
    lyrics = generate_lyrics(subject, concepts, music_genre, grade_level)
    plan = create_composition_plan(lyrics, music_genre)
    audio_data = compose_music(plan)
    
    return {
        "success": True,
        "lyrics": lyrics,
        "audio_data": audio_data
    }