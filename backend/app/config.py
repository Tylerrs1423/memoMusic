import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../../.env")

MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

