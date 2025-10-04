from fastapi import APIRouter
from app.models import Frontend, Session

router = APIRouter()


@router.post("/start-session")
def start_session(frontend: Frontend):
    session = Session(
        subject=frontend.subject,
        concepts=frontend.concepts,
        music_genre=frontend.music_genre,
        notes=frontend.notes
    )
    
    return {"message": "Session started successfully!"}

