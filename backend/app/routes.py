import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.app.models import Frontend, Session, Blank
from backend.app.services import generate_educational_song
from backend.app.database import db

router = APIRouter()


@router.post("/start-session")
def start_session(frontend: Frontend):
    song_result = generate_educational_song(
        subject=frontend.subject,
        concepts=frontend.concepts,
        music_genre=frontend.music_genre,
        grade_level=frontend.grade_level
    )
    
    # Create session with audio data
    session = Session(
        session_id=str(uuid.uuid4()),
        subject=frontend.subject,
        concepts=frontend.concepts,
        music_genre=frontend.music_genre,
        notes=frontend.notes,
        lyrics=song_result["lyrics"],
        practiced_lyrics=song_result["lyrics"],
        blanks=[],
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
        "audio_url": audio_url
    }


@router.get("/api/audio/{session_id}")
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

