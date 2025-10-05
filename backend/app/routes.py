import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.app.models import Frontend, Session, Blank
from typing import List
from backend.app.services import generate_educational_song
from backend.app.database import db
from pydantic import BaseModel

router = APIRouter()

class PracticeProgress(BaseModel):
    session_id: str
    completed_blanks: int
    total_blanks: int
    completion_rate: int
    last_practiced: str

@router.post("/start-session")
def start_session(frontend: Frontend):
    song_result = generate_educational_song(
        subject=frontend.subject,
        concepts=frontend.concepts,
        music_genre=frontend.music_genre,
        grade_level=frontend.grade_level
    )
    
    # Create session with audio data and practice materials
    session = Session(
        session_id=str(uuid.uuid4()),
        subject=frontend.subject,
        concepts=frontend.concepts,
        music_genre=frontend.music_genre,
        notes=frontend.notes,
        lyrics=song_result["lyrics"],
        practiced_lyrics=song_result["practiced_lyrics"],
        blanks=[Blank(**blank) for blank in song_result["blanks"]],
        audio_data=song_result["audio_data"],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    # Store session in MongoDB
    db.sessions.insert_one(session.model_dump())
    
    # Create streaming URL
    audio_url = f"/api/audio/{session.session_id}"
    
    return {
        "message": "Session started successfully!",
        "lyrics": song_result["lyrics"],
        "practiced_lyrics": song_result["practiced_lyrics"],
        "blanks": song_result["blanks"],
        "audio_url": audio_url
    }


@router.get("/api/audio-stream/{session_id}")
def stream_audio(session_id: str):
    """Stream audio from session in MongoDB"""
    session_doc = db.sessions.find_one({"session_id": session_id})
    
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    audio_data = session_doc["audio_data"]
    
    def generate():
        yield audio_data
    
    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={"Content-Disposition": f"inline; filename={session_id}.mp3"}
    )


@router.post("/api/practice-progress")
def save_practice_progress(progress: PracticeProgress):
    """Save practice progress to MongoDB"""
    # Update the session with practice progress
    result = db.sessions.update_one(
        {"session_id": progress.session_id},
        {
            "$set": {
                "practice_progress": {
                    "completed_blanks": progress.completed_blanks,
                    "total_blanks": progress.total_blanks,
                    "completion_rate": progress.completion_rate,
                    "last_practiced": progress.last_practiced
                },
                "updated_at": datetime.now()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Practice progress saved successfully"}


@router.get("/api/practice-progress/{session_id}")
def get_practice_progress(session_id: str):
    """Get practice progress for a session"""
    session_doc = db.sessions.find_one(
        {"session_id": session_id},
        {"practice_progress": 1, "session_id": 1}
    )
    
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session_doc.get("practice_progress", {
        "completed_blanks": 0,
        "total_blanks": 0,
        "completion_rate": 0,
        "last_practiced": None
    })


@router.get("/api/session/{session_id}")
def get_session_data(session_id: str):
    """Get complete session data for demo mode"""
    session_doc = db.sessions.find_one({"session_id": session_id})
    
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Convert ObjectId to string
    if "_id" in session_doc:
        session_doc["_id"] = str(session_doc["_id"])
    
    # Keep audio_data but don't include it in JSON response
    # Audio will be streamed separately via /api/audio/{session_id}
    if "audio_data" in session_doc:
        session_doc.pop("audio_data", None)
    
    return session_doc


@router.get("/api/audio/{session_id}")
def get_audio_file(session_id: str):
    """Get audio file for a session - either from MongoDB or generate fresh from ElevenLabs"""
    session_doc = db.sessions.find_one({"session_id": session_id})
    
    if not session_doc:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if we have audio_data in MongoDB
    if session_doc.get("audio_data"):
        # Return cached audio from MongoDB
        from fastapi.responses import Response
        return Response(
            content=session_doc["audio_data"],
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=audio_{session_id}.mp3"}
        )
    else:
        # Generate fresh audio from ElevenLabs using the lyrics
        from backend.app.services import create_composition_plan, compose_music
        
        lyrics = session_doc.get("lyrics", [])
        music_genre = session_doc.get("music_genre", "pop")
        
        if not lyrics:
            raise HTTPException(status_code=404, detail="No lyrics found")
        
        # Create plan and generate audio
        plan = create_composition_plan(lyrics, music_genre)
        audio_data = compose_music(plan)
        
        from fastapi.responses import Response
        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=audio_{session_id}.mp3"}
        )

