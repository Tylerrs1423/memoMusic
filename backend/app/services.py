import google.genai as genai
import requests
import json
import random
import whisper
from backend.app.config import GEMINI_API_KEY, ELEVENLABS_API_KEY
from backend.app.models import Blank

client = genai.Client(api_key=GEMINI_API_KEY)

# Load Whisper model (base model for good balance of speed/accuracy)
# whisper_model = whisper.load_model("base")  # Commented out for now

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

    # Debug: Print the original plan structure
    print(f"ElevenLabs original plan: {plan}")
    
    # Keep the original plan structure but only modify the first section's lines
    if plan.get("sections"):
        # Only replace the lyrics, keep everything else intact
        plan["sections"][0]["lines"] = lyrics
        plan["sections"][0]["positive_local_styles"] = [music_genre]
        
        # If there are multiple sections, remove extra sections to keep only our 8 lines
        if len(plan["sections"]) > 1:
            plan["sections"] = [plan["sections"][0]]  # Keep only first section
            plan["sections"][0]["duration_ms"] = 48000  # Set total duration
    
    print(f"Modified plan: {len(plan.get('sections', []))} section(s)")
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
    
    if not response.ok:
        print(f"ElevenLabs music generation error: {response.status_code}")
        print(f"Response: {response.text}")
        response.raise_for_status()
    
    return response.content

# Whisper will be loaded lazily when first needed
whisper_model = None

def get_whisper_model():
    """Load Whisper model lazily"""
    global whisper_model
    if whisper_model is None:
        print("Loading Whisper model (this may take a moment on first run)...")
        whisper_model = whisper.load_model("base")
        print("Whisper model loaded successfully!")
    return whisper_model

def transcribe_audio_with_timestamps(audio_data: bytes, lyrics: list) -> dict:
    """Use Whisper to get word-level timestamps for the audio"""
    try:
        # Save audio data to temporary file for Whisper
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        # Get Whisper model and transcribe with word-level timestamps
        model = get_whisper_model()
        result = model.transcribe(temp_file_path, word_timestamps=True)
        
        # Debug: Print what Whisper actually returned
        print(f"🔍 Whisper result type: {type(result)}")
        print(f"🔍 Whisper result keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
        
        # Extract words from segments if available
        words = []
        if 'segments' in result:
            for segment in result['segments']:
                if 'words' in segment:
                    words.extend(segment['words'])
            print(f"🔍 Extracted {len(words)} words from segments")
            if words:
                print(f"🔍 First few words: {words[:3]}")
        
        # Add words to result for compatibility
        result['words'] = words
        
        # Clean up temp file
        os.unlink(temp_file_path)
        
        return result
        
    except Exception as e:
        print(f"Whisper transcription error: {e}")
        # Return mock result if Whisper fails
        return {
            "text": " ".join(lyrics),
            "words": [
                {"word": word.strip('.,!?;:"()[]{}'), "start": i * 2.0, "end": (i + 1) * 2.0}
                for i, line in enumerate(lyrics) for word in line.split()
            ],
            "segments": []
        }

def select_words_for_blanks_with_gemini(lyrics: list, subject: str, concepts: list, num_blanks: int = 4) -> list:
    """Use Gemini to intelligently select the most important words for blanks"""
    
    lyrics_text = "\n".join(lyrics)
    concepts_text = ", ".join(concepts) if concepts else ""
    
    prompt = f"""
Subject: {subject}
Key Concepts: {concepts_text}
Lyrics:
{lyrics_text}

Instructions:
Analyze these educational lyrics and identify the {num_blanks} MOST IMPORTANT words that students need to learn and remember.
These should be:
- Key subject-specific terms
- Important concepts or formulas
- Critical vocabulary words
- Words that are central to understanding the topic

Return ONLY a JSON array with the exact words (as they appear in the lyrics), one per line.
Format: ["word1", "word2", "word3", "word4"]

CRITICAL: Return ONLY the JSON array. No explanations, no formatting, no extra text.
"""
    
    response_text = generate_content(prompt)
    
    try:
        # Parse the JSON response
        import re
        # Extract JSON array from response
        json_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
        if json_match:
            json_str = "[" + json_match.group(1) + "]"
            selected_words = json.loads(json_str)
        else:
            # Fallback: try to parse the whole response as JSON
            selected_words = json.loads(response_text.strip())
        
        # Clean up the words and find their positions
        blanks_info = []
        for word in selected_words:
            word = word.strip().strip('.,!?;:"()[]{}')
            if word:
                # Find this word in the lyrics
                for line_idx, line in enumerate(lyrics):
                    words_in_line = line.split()
                    for word_idx, line_word in enumerate(words_in_line):
                        clean_line_word = line_word.strip('.,!?;:"()[]{}')
                        if clean_line_word.lower() == word.lower():
                            blanks_info.append({
                                'line_index': line_idx,
                                'word_position': word_idx,
                                'original_word': clean_line_word,
                                'full_word': line_word
                            })
                            break
                    if blanks_info and blanks_info[-1]['original_word'].lower() == word.lower():
                        break
        
        return blanks_info[:num_blanks]
        
    except Exception as e:
        print(f"Error parsing Gemini response for word selection: {e}")
        print(f"Response was: {response_text}")
        # Fallback to simple selection
        return select_words_for_blanks_fallback(lyrics, num_blanks)

def select_words_for_blanks_fallback(lyrics: list, num_blanks: int = 4) -> list:
    """Fallback method to select words if Gemini fails"""
    all_words = []
    
    for line_idx, line in enumerate(lyrics):
        if line.strip():
            words = line.strip().split()
            for word_idx, word in enumerate(words):
                clean_word = word.strip('.,!?;:"()[]{}')
                if len(clean_word) > 3 and clean_word.lower() not in ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'they', 'them', 'their']:
                    all_words.append({
                        'line_index': line_idx,
                        'word_position': word_idx,
                        'original_word': clean_word,
                        'full_word': word
                    })
    
    if len(all_words) <= num_blanks:
        return all_words
    else:
        return random.sample(all_words, num_blanks)

def create_practiced_lyrics(lyrics: list, blanks_info: list) -> list:
    """Create practiced lyrics with blanks replacing selected words"""
    practiced_lyrics = lyrics.copy()
    
    for blank_info in blanks_info:
        line_idx = blank_info['line_index']
        word_pos = blank_info['word_position']
        
        if line_idx < len(practiced_lyrics):
            words = practiced_lyrics[line_idx].split()
            if word_pos < len(words):
                # Replace the word with blanks, preserving punctuation
                words[word_pos] = "___"
                practiced_lyrics[line_idx] = " ".join(words)
    
    return practiced_lyrics

def create_blanks_with_timestamps(blanks_info: list, whisper_result: dict) -> list:
    """Create Blank objects with timing information from Whisper"""
    blanks = []
    
    print("🎯 Matching words with Whisper timestamps...")
    
    # Create a mapping from words to their timestamps
    word_timestamps = {}
    if 'words' in whisper_result:
        for word_info in whisper_result['words']:
            word_text = word_info.get('word', '').strip().lower()
            start_time = word_info.get('start', 0.0)
            end_time = word_info.get('end', 0.0)
            word_timestamps[word_text] = {
                'start': start_time,
                'end': end_time
            }
    
    print(f"📊 Whisper found {len(word_timestamps)} words with timestamps")
    
    for blank_info in blanks_info:
        original_word = blank_info['original_word'].strip().lower()
        
        # Try exact match first
        timing = word_timestamps.get(original_word, None)
        
        # If no exact match, try fuzzy matching (be more strict)
        if not timing:
            for whisper_word, whisper_timing in word_timestamps.items():
                whisper_clean = whisper_word.strip().strip('.,!?;:"()[]{}').lower()
                original_clean = original_word.strip().strip('.,!?;:"()[]{}').lower()
                
                # Only match if it's a substantial match (not just common words)
                if (whisper_clean == original_clean or
                    (len(original_clean) > 4 and 
                     (whisper_clean.startswith(original_clean[:4]) or 
                      original_clean.startswith(whisper_clean[:4])))):
                    timing = whisper_timing
                    print(f"🎯 Fuzzy matched '{original_word}' with '{whisper_word}' at {timing['start']:.2f}s")
                    break
        
        # If still no match, estimate based on line position
        if not timing:
            # Estimate timing based on line position (rough approximation)
            estimated_start = blank_info['line_index'] * 6.0  # ~6 seconds per line
            timing = {'start': estimated_start, 'end': estimated_start + 1.0}
            print(f"⚠️  No timestamp found for '{original_word}', estimated {timing['start']:.2f}s")
        
        blank = Blank(
            line_index=blank_info['line_index'],
            word_position=blank_info['word_position'],
            original_word=blank_info['original_word'],
            start_time=timing['start'],
            end_time=timing['end']
        )
        blanks.append(blank)
    
    return blanks

def generate_educational_song(subject: str, concepts: list, music_genre: str = "pop", grade_level: str = "high school") -> dict:
    """Complete pipeline: generate lyrics, select blanks, compose music, and create practice materials"""
    print("🎵 Generating lyrics...")
    lyrics = generate_lyrics(subject, concepts, music_genre, grade_level)
    
    print("🧠 Selecting key words for blanks with Gemini...")
    # Select blanks FIRST so we know which words to emphasize
    blanks_info = select_words_for_blanks_with_gemini(lyrics, subject, concepts, num_blanks=4)
    
    print("🎼 Creating composition plan...")
    plan = create_composition_plan(lyrics, music_genre)
    
    print("🎤 Composing music with ElevenLabs...")
    audio_data = compose_music(plan)
    
    print("🎯 Transcribing audio with Whisper...")
    whisper_result = transcribe_audio_with_timestamps(audio_data, lyrics)
    
    print("📝 Creating practice materials...")
    # Create practiced lyrics with blanks
    practiced_lyrics = create_practiced_lyrics(lyrics, blanks_info)
    
    # Create blanks with timing information
    blanks = create_blanks_with_timestamps(blanks_info, whisper_result)
    
    print("✅ Song generation complete!")
    print(f"📊 Created {len(blanks)} blanks with timing info")
    
    return {
        "success": True,
        "lyrics": lyrics,
        "practiced_lyrics": practiced_lyrics,
        "blanks": [blank.model_dump() for blank in blanks],
        "audio_data": audio_data
    } 