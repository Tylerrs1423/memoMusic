#!/usr/bin/env python3
"""
Generate a single demo song to avoid overloading Gemini
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.services import generate_educational_song
from backend.app.database import db
import uuid
from datetime import datetime

def generate_single_demo_song(subject):
    """Generate one demo song"""
    
    configs = {
        'Computer Science': {
            'concepts': ['stack', 'last one in first one out', 'push', 'pop'],
            'music_genre': 'rap',
            'grade_level': 'high school',
            'notes': 'Demo song for stack data structure'
        },
        'Biology': {
            'concepts': ['photosynthesis', 'chlorophyll', 'glucose', 'oxygen'],
            'music_genre': 'pop',
            'grade_level': 'high school',
            'notes': 'Demo song for photosynthesis'
        },
        'Physics': {
            'concepts': ['gravity', 'force', 'mass', 'Newton'],
            'music_genre': 'r&b',
            'grade_level': 'high school',
            'notes': 'Demo song for gravity'
        }
    }
    
    if subject not in configs:
        print(f"❌ Unknown subject: {subject}")
        return
    
    config = configs[subject]
    print(f"🎵 Generating {subject} demo song...")
    
    try:
        # Generate the song
        result = generate_educational_song(
            subject=subject,
            concepts=config['concepts'],
            music_genre=config['music_genre'],
            grade_level=config['grade_level']
        )
        
        if not result.get('success'):
            print(f"❌ Failed to generate {subject}")
            return
        
        # Create session document
        session_id = str(uuid.uuid4())
        session_doc = {
            'session_id': session_id,
            'subject': subject,
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
        
        print(f"✅ Saved {subject} song to MongoDB")
        print(f"   Session ID: {session_id}")
        print(f"   Style: {config['music_genre']}")
        print(f"   Concepts: {config['concepts']}")
        print(f"   Blanks: {len(result['blanks'])}")
        
    except Exception as e:
        print(f"❌ Error generating {subject}: {str(e)}")

if __name__ == "__main__":
    import sys
    subject = sys.argv[1] if len(sys.argv) > 1 else 'Computer Science'
    generate_single_demo_song(subject)
