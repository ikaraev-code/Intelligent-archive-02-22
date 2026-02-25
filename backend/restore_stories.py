#!/usr/bin/env python3
"""
Restore stories from backup JSON file.
Run: python3 restore_stories.py
"""
import json
import os
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

def restore():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    backup_file = "/app/backend/story_backup.json"
    if not os.path.exists(backup_file):
        print(f"Backup file not found: {backup_file}")
        return
    
    with open(backup_file, "r") as f:
        backup = json.load(f)
    
    print(f"Backup from: {backup.get('exported_at')}")
    
    # Restore stories
    stories = backup.get("stories", [])
    for story in stories:
        existing = db.stories.find_one({"id": story["id"]})
        if existing:
            print(f"  Story '{story['name']}' already exists, skipping")
        else:
            db.stories.insert_one(story)
            print(f"  Restored story: {story['name']}")
    
    # Restore chapters
    chapters = backup.get("chapters", [])
    for chapter in chapters:
        existing = db.chapters.find_one({"id": chapter["id"]})
        if existing:
            print(f"  Chapter '{chapter['name']}' already exists, skipping")
        else:
            db.chapters.insert_one(chapter)
            print(f"  Restored chapter: {chapter['name']}")
    
    # Restore story messages
    messages = backup.get("story_messages", [])
    restored_msgs = 0
    for msg in messages:
        existing = db.story_messages.find_one({"id": msg["id"]})
        if not existing:
            db.story_messages.insert_one(msg)
            restored_msgs += 1
    print(f"  Restored {restored_msgs} story messages")
    
    print("\nRestore complete!")

if __name__ == "__main__":
    restore()
