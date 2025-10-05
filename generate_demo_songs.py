#!/usr/bin/env python3
"""
Script to generate demo songs and store them in MongoDB
Run this to create all your demo songs with ElevenLabs audio
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.services import generate_educational_song
from backend.app.database import db
import uuid
from datetime import datetime

def generate_and_save_demo_songs():
    """Generate all demo songs and save to MongoDB"""
    
    # Your demo songs configuration
    demo_configs = [
        {
            'subject': 'Computer Science',
            'concepts': ['stack', 'last one in first one out', 'push', 'pop'],
            'music_genre': 'rap',
            'grade_level': 'high school',
            'notes': 'Demo song for stack data structure'
        },
        {
            'subject': 'Biology', 
            'concepts': ['photosynthesis', 'chlorophyll', 'glucose', 'oxygen'],
            'music_genre': 'pop',
            'grade_level': 'high school',
            'notes': 'Demo song for photosynthesis'
        },
        {
            'subject': 'Physics',
            'concepts': ['gravity', 'force', 'mass', 'Newton'],
            'music_genre': 'r&b', 
            'grade_level': 'high school',
            'notes': 'Demo song for gravity'
        }
    ]
    
    print("🎵 Starting demo song generation...")
    
    for i, config in enumerate(demo_configs, 1):
        print(f"\n📝 Generating song {i}/3: {config['subject']}")
        
        try:
            # Generate the song (this will use your DEMO_SCRIPTS)
            result = generate_educational_song(
                subject=config['subject'],
                concepts=config['concepts'],
                music_genre=config['music_genre'],
                grade_level=config['grade_level']
            )
            
            if not result.get('success'):
                print(f"❌ Failed to generate {config['subject']}")
                continue
            
            # Create session document for MongoDB
            session_id = str(uuid.uuid4())
            session_doc = {
                'session_id': session_id,
                'subject': config['subject'],
                'concepts': config['concepts'],
                'music_genre': config['music_genre'],
                'grade_level': config['grade_level'],
                'notes': config['notes'],
                'lyrics': result['lyrics'],
                'practiced_lyrics': result['practiced_lyrics'],
                'blanks': result['blanks'],
                'audio_data': result['audio_data'],
                'created_at': datetime.now(),
                'practice_progress': {
                    'completed_blanks': 0,
                    'total_blanks': len(result['blanks']),
                    'completion_rate': 0,
                    'last_practiced': None
                }
            }
            
            # Save to MongoDB
            db.sessions.insert_one(session_doc)
            
            print(f"✅ Saved {config['subject']} song to MongoDB")
            print(f"   Session ID: {session_id}")
            print(f"   Blanks: {len(result['blanks'])}")
            print(f"   Audio size: {len(result['audio_data'])} bytes")
            
        except Exception as e:
            print(f"❌ Error generating {config['subject']}: {str(e)}")
            continue
    
    print(f"\n🎉 Demo song generation complete!")
    print(f"📊 Check your MongoDB 'sessions' collection for the new songs")

if __name__ == "__main__":
    generate_and_save_demo_songs()
