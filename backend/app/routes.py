import uuid
from datetime import datetime
from fastapi import APIRouter
from app.models import Frontend, Session, Blank

router = APIRouter()


@router.post("/start-session")
def start_session(frontend: Frontend):
    
   



    session = Session(
        session_id=str(uuid.uuid4()),
        subject=frontend.subject,
        concepts=frontend.concepts,
        music_genre=frontend.music_genre,
        notes=frontend.notes,
        lyrics=[],  # Default empty
        practiced_lyrics=[],  # Default empty
        blanks=[],  # Default empty
        audio_url="",  # Default empty
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    return {
        "message": "Session started successfully!",
        "session": session.model_dump()
    }

