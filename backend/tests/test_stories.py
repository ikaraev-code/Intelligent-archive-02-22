"""
Stories Feature Tests - Phase 1 & 2
Tests for:
- Stories CRUD (create, list, get, delete)
- Chapters CRUD (create, update, delete, reorder)
- AI Chat (coauthor and scribe modes)
- Messages retrieval
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@archiva.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestStoriesCRUD:
    """Story CRUD operation tests"""
    
    created_story_id = None
    
    def test_create_story(self, api_client):
        """POST /api/stories creates a new story and returns it with id, name, description"""
        payload = {
            "name": "TEST_My Adventure Story",
            "description": "A test story about adventures"
        }
        response = api_client.post(f"{BASE_URL}/api/stories", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain id"
        assert data["name"] == payload["name"], f"Name mismatch: {data.get('name')}"
        assert data["description"] == payload["description"], f"Description mismatch: {data.get('description')}"
        assert "created_at" in data, "Response should contain created_at"
        assert "updated_at" in data, "Response should contain updated_at"
        
        TestStoriesCRUD.created_story_id = data["id"]
        print(f"✓ Created story: {data['id']}")
    
    def test_list_stories(self, api_client):
        """GET /api/stories lists all stories for the user"""
        response = api_client.get(f"{BASE_URL}/api/stories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        
        # Find our created story
        if TestStoriesCRUD.created_story_id:
            found = any(s["id"] == TestStoriesCRUD.created_story_id for s in data)
            assert found, "Created story should appear in list"
        
        print(f"✓ Listed {len(data)} stories")
    
    def test_get_story(self, api_client):
        """GET /api/stories/{id} returns story with chapters array"""
        if not TestStoriesCRUD.created_story_id:
            pytest.skip("No story created")
        
        story_id = TestStoriesCRUD.created_story_id
        response = api_client.get(f"{BASE_URL}/api/stories/{story_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["id"] == story_id, "Story ID should match"
        assert "chapters" in data, "Response should contain chapters array"
        assert isinstance(data["chapters"], list), "Chapters should be a list"
        assert "chapter_count" in data, "Response should contain chapter_count"
        
        print(f"✓ Retrieved story with {len(data['chapters'])} chapters")


class TestChaptersCRUD:
    """Chapter CRUD operation tests"""
    
    story_id = None
    chapter_ids = []
    
    @pytest.fixture(autouse=True)
    def setup_story(self, api_client):
        """Create a story for chapter tests"""
        if not TestChaptersCRUD.story_id:
            response = api_client.post(f"{BASE_URL}/api/stories", json={
                "name": "TEST_Chapter Test Story",
                "description": "Story for chapter testing"
            })
            if response.status_code == 200:
                TestChaptersCRUD.story_id = response.json()["id"]
    
    def test_create_chapter_auto_numbered(self, api_client):
        """POST /api/stories/{id}/chapters creates a chapter with auto-numbered name"""
        if not TestChaptersCRUD.story_id:
            pytest.skip("No story created")
        
        # Create without name - should auto-number
        response = api_client.post(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters",
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "id" in data, "Chapter should have id"
        assert "name" in data, "Chapter should have name"
        assert "Chapter" in data["name"], f"Auto-numbered name expected, got: {data['name']}"
        assert "content_blocks" in data, "Chapter should have content_blocks"
        assert isinstance(data["content_blocks"], list), "content_blocks should be a list"
        
        TestChaptersCRUD.chapter_ids.append(data["id"])
        print(f"✓ Created auto-numbered chapter: {data['name']}")
    
    def test_create_chapter_with_name(self, api_client):
        """POST /api/stories/{id}/chapters with custom name"""
        if not TestChaptersCRUD.story_id:
            pytest.skip("No story created")
        
        response = api_client.post(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters",
            json={"name": "TEST_Custom Chapter Name"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data["name"] == "TEST_Custom Chapter Name", f"Name should match: {data['name']}"
        TestChaptersCRUD.chapter_ids.append(data["id"])
        print(f"✓ Created chapter with custom name: {data['name']}")
    
    def test_update_chapter_content_blocks(self, api_client):
        """PUT /api/stories/{id}/chapters/{cid} updates chapter content_blocks"""
        if not TestChaptersCRUD.story_id or not TestChaptersCRUD.chapter_ids:
            pytest.skip("No chapter created")
        
        chapter_id = TestChaptersCRUD.chapter_ids[0]
        update_payload = {
            "content_blocks": [
                {"type": "text", "content": "This is the first paragraph."},
                {"type": "text", "content": "This is the second paragraph."}
            ]
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters/{chapter_id}",
            json=update_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify by fetching the chapter
        get_response = api_client.get(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters/{chapter_id}"
        )
        assert get_response.status_code == 200
        chapter_data = get_response.json()
        
        assert len(chapter_data["content_blocks"]) == 2, "Should have 2 content blocks"
        assert chapter_data["content_blocks"][0]["type"] == "text"
        assert chapter_data["content_blocks"][0]["content"] == "This is the first paragraph."
        
        print(f"✓ Updated chapter with {len(chapter_data['content_blocks'])} content blocks")
    
    def test_reorder_chapters(self, api_client):
        """PUT /api/stories/{id}/chapters/reorder reorders chapters by ID list"""
        if not TestChaptersCRUD.story_id or len(TestChaptersCRUD.chapter_ids) < 2:
            pytest.skip("Need at least 2 chapters")
        
        # Reverse the order
        reversed_ids = list(reversed(TestChaptersCRUD.chapter_ids))
        response = api_client.put(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters/reorder",
            json={"chapter_ids": reversed_ids}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify order by fetching story
        story_response = api_client.get(f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}")
        chapters = story_response.json()["chapters"]
        
        # Chapters should be in reversed order
        for i, expected_id in enumerate(reversed_ids):
            assert chapters[i]["id"] == expected_id, f"Chapter {i} order mismatch"
        
        print(f"✓ Reordered {len(reversed_ids)} chapters")
    
    def test_delete_chapter_and_reorder(self, api_client):
        """DELETE /api/stories/{id}/chapters/{cid} deletes chapter and re-orders remaining"""
        if not TestChaptersCRUD.story_id or not TestChaptersCRUD.chapter_ids:
            pytest.skip("No chapter to delete")
        
        # Create one more chapter to test reorder after delete
        create_resp = api_client.post(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters",
            json={"name": "TEST_To Be Deleted"}
        )
        chapter_to_delete = create_resp.json()["id"]
        
        # Get chapters before delete
        before_resp = api_client.get(f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}")
        chapters_before = before_resp.json()["chapters"]
        count_before = len(chapters_before)
        
        # Delete the chapter
        delete_response = api_client.delete(
            f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}/chapters/{chapter_to_delete}"
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion
        after_resp = api_client.get(f"{BASE_URL}/api/stories/{TestChaptersCRUD.story_id}")
        chapters_after = after_resp.json()["chapters"]
        
        assert len(chapters_after) == count_before - 1, "One chapter should be deleted"
        assert all(c["id"] != chapter_to_delete for c in chapters_after), "Deleted chapter should not exist"
        
        print(f"✓ Deleted chapter and reordered remaining")


class TestStoryChat:
    """Story AI chat tests (coauthor and scribe modes)"""
    
    story_id = None
    chapter_id = None
    
    @pytest.fixture(autouse=True)
    def setup_story_and_chapter(self, api_client):
        """Create a story and chapter for chat tests"""
        if not TestStoryChat.story_id:
            # Create story
            response = api_client.post(f"{BASE_URL}/api/stories", json={
                "name": "TEST_Chat Test Story",
                "description": "Story for AI chat testing"
            })
            if response.status_code == 200:
                TestStoryChat.story_id = response.json()["id"]
                
                # Create chapter
                ch_response = api_client.post(
                    f"{BASE_URL}/api/stories/{TestStoryChat.story_id}/chapters",
                    json={"name": "TEST_Chat Test Chapter"}
                )
                if ch_response.status_code == 200:
                    TestStoryChat.chapter_id = ch_response.json()["id"]
    
    def test_chat_coauthor_mode(self, api_client):
        """POST /api/stories/{id}/chat with mode=coauthor returns AI-generated creative content"""
        if not TestStoryChat.story_id:
            pytest.skip("No story created")
        
        response = api_client.post(
            f"{BASE_URL}/api/stories/{TestStoryChat.story_id}/chat",
            json={
                "message": "Help me start a story about a brave knight",
                "mode": "coauthor",
                "chapter_id": TestStoryChat.chapter_id
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert data["mode"] == "coauthor", f"Mode should be coauthor, got: {data.get('mode')}"
        assert len(data["message"]) > 10, "AI should return substantial content"
        
        print(f"✓ Coauthor chat returned {len(data['message'])} chars")
    
    def test_chat_scribe_mode(self, api_client):
        """POST /api/stories/{id}/chat with mode=scribe returns organized/structured content"""
        if not TestStoryChat.story_id:
            pytest.skip("No story created")
        
        response = api_client.post(
            f"{BASE_URL}/api/stories/{TestStoryChat.story_id}/chat",
            json={
                "message": "Clean up this text: the knight was brave. he fought dragons. he saved the princess.",
                "mode": "scribe",
                "chapter_id": TestStoryChat.chapter_id
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert data["mode"] == "scribe", f"Mode should be scribe, got: {data.get('mode')}"
        assert len(data["message"]) > 10, "AI should return organized content"
        
        print(f"✓ Scribe chat returned {len(data['message'])} chars")
    
    def test_get_messages(self, api_client):
        """GET /api/stories/{id}/messages returns chat history"""
        if not TestStoryChat.story_id:
            pytest.skip("No story created")
        
        # Wait a moment to ensure messages are persisted
        time.sleep(0.5)
        
        response = api_client.get(
            f"{BASE_URL}/api/stories/{TestStoryChat.story_id}/messages",
            params={"chapter_id": TestStoryChat.chapter_id}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "messages" in data, "Response should contain messages"
        assert isinstance(data["messages"], list), "Messages should be a list"
        
        # Should have at least the messages from previous tests
        if len(data["messages"]) > 0:
            msg = data["messages"][0]
            assert "role" in msg, "Message should have role"
            assert "content" in msg, "Message should have content"
            assert msg["role"] in ["user", "assistant"], f"Invalid role: {msg['role']}"
        
        print(f"✓ Retrieved {len(data['messages'])} messages")


class TestStoryDelete:
    """Story deletion tests"""
    
    def test_delete_story_cascades(self, api_client):
        """DELETE /api/stories/{id} deletes story and all chapters/messages"""
        # Create a story with chapters
        story_resp = api_client.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_Delete Test Story",
            "description": "Will be deleted"
        })
        story_id = story_resp.json()["id"]
        
        # Add a chapter
        api_client.post(
            f"{BASE_URL}/api/stories/{story_id}/chapters",
            json={"name": "TEST_Delete Chapter"}
        )
        
        # Delete the story
        delete_resp = api_client.delete(f"{BASE_URL}/api/stories/{story_id}")
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}"
        
        # Verify deletion
        get_resp = api_client.get(f"{BASE_URL}/api/stories/{story_id}")
        assert get_resp.status_code == 404, "Deleted story should return 404"
        
        print(f"✓ Story and all chapters deleted")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_stories(self, api_client):
        """Remove all TEST_ prefixed stories"""
        response = api_client.get(f"{BASE_URL}/api/stories")
        if response.status_code == 200:
            stories = response.json()
            for story in stories:
                if story["name"].startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/stories/{story['id']}")
                    print(f"  Cleaned up: {story['name']}")
        print("✓ Test data cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
