import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

# Load environment variables from project root
load_dotenv(dotenv_path="../.env")

# Get MongoDB URI from environment variables
uri = os.getenv("MONGO_URI")


# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

db = client["memo_music"]