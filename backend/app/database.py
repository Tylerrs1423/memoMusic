from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from config import MONGO_URI, GEMINI_API_KEY

# Create a new client and connect to the server
client = MongoClient(MONGO_URI, server_api=ServerApi('1'))

db = client["memo_music"]