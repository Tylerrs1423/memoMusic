#!/usr/bin/env python3
"""
Script to get the actual session IDs from MongoDB and update the frontend
Run this after generating demo songs to get the real session IDs
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.database import db
from pprint import pprint

def get_demo_session_ids():
    """Get the actual session IDs from MongoDB"""
    
    print("🔍 Fetching demo session IDs from MongoDB...")
    
    # Get all sessions from MongoDB
    sessions = list(db.sessions.find({}, {'session_id': 1, 'subject': 1, 'created_at': 1}))
    
    if not sessions:
        print("❌ No sessions found in MongoDB. Run generate_demo_songs.py first!")
        return
    
    print(f"\n📊 Found {len(sessions)} sessions in MongoDB:")
    
    # Sort by creation date (newest first)
    sessions.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    demo_sessions = []
    for session in sessions[:3]:  # Get the 3 most recent
        session_id = session['session_id']
        subject = session['subject']
        created = session.get('created_at', 'Unknown')
        
        print(f"  • {subject}: {session_id}")
        demo_sessions.append(session_id)
    
    print(f"\n🎯 Demo session IDs for your frontend:")
    print(f"const DEMO_SESSION_MAP = {{")
    print(f"  'Computer Science': '{demo_sessions[0] if len(demo_sessions) > 0 else 'PLACEHOLDER'}, // {sessions[0]['subject'] if len(sessions) > 0 else 'N/A'}")
    print(f"  'Biology': '{demo_sessions[1] if len(demo_sessions) > 1 else 'PLACEHOLDER'}, // {sessions[1]['subject'] if len(sessions) > 1 else 'N/A'}")
    print(f"  'Physics': '{demo_sessions[2] if len(demo_sessions) > 2 else 'PLACEHOLDER'}, // {sessions[2]['subject'] if len(sessions) > 2 else 'N/A'}")
    print(f"}};")
    
    print(f"\n📝 Copy these IDs to your app.js DEMO_SESSION_MAP!")

if __name__ == "__main__":
    get_demo_session_ids()
