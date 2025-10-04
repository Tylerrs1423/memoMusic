from fastapi import APIRouter

router = APIRouter()


@router.post("/create-session")
def create_session(session: Session):
    db.sessions.insert_one(session.model_dump())
    return {"message": "Session created successfully!"}

