"""
Test Stories Feature - Critical Bug Fix Verification
=====================================================
Tests the fix for: Race condition where adding AI content to Chapter 1, switching to Chapter 2,
and adding content there would cause Chapter 1's content to be lost.

The fix uses atomic append endpoint with MongoDB $push operator instead of overwriting content.
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Get authentication token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@archiva.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestStoriesCRUD(TestAuth):
    """Test Stories CRUD Operations"""
    
    def test_create_story(self, headers):
        """Create a new story"""
        response = requests.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_Persistence_Story",
            "description": "Testing chapter content persistence"
        }, headers=headers)
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Persistence_Story"
        self.__class__.story_id = data["id"]
        print(f"✓ Created story: {data['id']}")
    
    def test_list_stories(self, headers):
        """List all stories"""
        response = requests.get(f"{BASE_URL}/api/stories", headers=headers)
        assert response.status_code == 200
        stories = response.json()
        assert isinstance(stories, list)
        assert any(s.get("name") == "TEST_Persistence_Story" for s in stories)
        print(f"✓ Listed {len(stories)} stories")
    
    def test_get_story(self, headers):
        """Get single story by ID"""
        story_id = getattr(self.__class__, 'story_id', None)
        assert story_id, "Story not created"
        
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == story_id
        assert "chapters" in data
        print(f"✓ Got story details with {len(data.get('chapters', []))} chapters")


class TestChaptersCRUD(TestAuth):
    """Test Chapters CRUD Operations"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_story(self, headers):
        """Create a story for chapter tests"""
        response = requests.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_Chapters_CRUD_Story",
            "description": "For testing chapters"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.story_id = response.json()["id"]
        yield
        # Cleanup
        requests.delete(f"{BASE_URL}/api/stories/{self.__class__.story_id}", headers=headers)
    
    def test_create_chapter_1(self, headers):
        """Create Chapter 1"""
        story_id = self.__class__.story_id
        response = requests.post(f"{BASE_URL}/api/stories/{story_id}/chapters", json={
            "name": "Chapter 1 - Introduction"
        }, headers=headers)
        assert response.status_code == 200, f"Create chapter failed: {response.text}"
        data = response.json()
        assert "id" in data
        self.__class__.chapter1_id = data["id"]
        print(f"✓ Created Chapter 1: {data['id']}")
    
    def test_create_chapter_2(self, headers):
        """Create Chapter 2"""
        story_id = self.__class__.story_id
        response = requests.post(f"{BASE_URL}/api/stories/{story_id}/chapters", json={
            "name": "Chapter 2 - Development"
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        self.__class__.chapter2_id = data["id"]
        print(f"✓ Created Chapter 2: {data['id']}")
    
    def test_select_chapter(self, headers):
        """Get chapter details"""
        story_id = self.__class__.story_id
        chapter_id = getattr(self.__class__, 'chapter1_id', None)
        assert chapter_id, "Chapter 1 not created"
        
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == chapter_id
        print(f"✓ Got Chapter 1 details")
    
    def test_delete_chapter(self, headers):
        """Delete chapter"""
        story_id = self.__class__.story_id
        # Create a chapter to delete
        response = requests.post(f"{BASE_URL}/api/stories/{story_id}/chapters", json={
            "name": "Chapter to Delete"
        }, headers=headers)
        assert response.status_code == 200
        delete_id = response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/stories/{story_id}/chapters/{delete_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Deleted chapter successfully")


class TestCriticalBugFix(TestAuth):
    """
    CRITICAL TEST: Content Persistence Across Chapters
    
    This tests the bug fix for race condition where:
    1. Add content to Chapter 1
    2. Switch to Chapter 2, add content there
    3. Chapter 1 content should NOT be lost
    
    The fix uses atomic $push operation instead of overwriting content arrays.
    """
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_story(self, headers):
        """Create a story with 2 chapters for persistence testing"""
        # Create story
        response = requests.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_Critical_Bug_Fix_Story",
            "description": "Testing content persistence across chapters"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.story_id = response.json()["id"]
        
        # Create Chapter 1
        response = requests.post(f"{BASE_URL}/api/stories/{self.__class__.story_id}/chapters", json={
            "name": "Chapter 1"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.chapter1_id = response.json()["id"]
        
        # Create Chapter 2
        response = requests.post(f"{BASE_URL}/api/stories/{self.__class__.story_id}/chapters", json={
            "name": "Chapter 2"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.chapter2_id = response.json()["id"]
        
        yield
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/stories/{self.__class__.story_id}", headers=headers)
    
    def test_01_add_content_to_chapter_1(self, headers):
        """Step 1: Add content to Chapter 1"""
        story_id = self.__class__.story_id
        chapter1_id = self.__class__.chapter1_id
        
        response = requests.post(
            f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter1_id}/append-blocks",
            json={"blocks": [{"type": "text", "content": "CHAPTER 1 CONTENT - SHOULD PERSIST"}]},
            headers=headers
        )
        assert response.status_code == 200, f"Append to Chapter 1 failed: {response.text}"
        data = response.json()
        assert data["total_blocks"] >= 1
        print(f"✓ Added content to Chapter 1 (total blocks: {data['total_blocks']})")
    
    def test_02_verify_chapter_1_has_content(self, headers):
        """Verify Chapter 1 has the content"""
        story_id = self.__class__.story_id
        chapter1_id = self.__class__.chapter1_id
        
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter1_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        blocks = data.get("content_blocks", [])
        assert len(blocks) >= 1, "Chapter 1 should have at least 1 content block"
        assert any("CHAPTER 1 CONTENT" in (b.get("content") or "") for b in blocks)
        print(f"✓ Verified Chapter 1 has content ({len(blocks)} blocks)")
    
    def test_03_switch_to_chapter_2_add_content(self, headers):
        """Step 2: Switch to Chapter 2 and add content (simulating the race condition scenario)"""
        story_id = self.__class__.story_id
        chapter2_id = self.__class__.chapter2_id
        
        response = requests.post(
            f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter2_id}/append-blocks",
            json={"blocks": [{"type": "text", "content": "CHAPTER 2 CONTENT - NEW CONTENT"}]},
            headers=headers
        )
        assert response.status_code == 200, f"Append to Chapter 2 failed: {response.text}"
        data = response.json()
        assert data["total_blocks"] >= 1
        print(f"✓ Added content to Chapter 2 (total blocks: {data['total_blocks']})")
    
    def test_04_CRITICAL_verify_chapter_1_content_not_lost(self, headers):
        """
        CRITICAL: Verify Chapter 1 content is NOT lost after adding content to Chapter 2.
        This is the main bug that was fixed.
        """
        story_id = self.__class__.story_id
        chapter1_id = self.__class__.chapter1_id
        
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter1_id}", headers=headers)
        assert response.status_code == 200, f"Failed to get Chapter 1: {response.text}"
        
        data = response.json()
        blocks = data.get("content_blocks", [])
        
        # CRITICAL ASSERTION: Chapter 1 content should NOT be lost
        assert len(blocks) >= 1, "CRITICAL BUG: Chapter 1 lost its content after switching to Chapter 2!"
        assert any("CHAPTER 1 CONTENT" in (b.get("content") or "") for b in blocks), \
            "CRITICAL BUG: Chapter 1's specific content is missing!"
        
        print(f"✓ CRITICAL TEST PASSED: Chapter 1 content persisted ({len(blocks)} blocks)")
    
    def test_05_verify_chapter_2_has_content(self, headers):
        """Verify Chapter 2 also has its content"""
        story_id = self.__class__.story_id
        chapter2_id = self.__class__.chapter2_id
        
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter2_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        blocks = data.get("content_blocks", [])
        assert len(blocks) >= 1, "Chapter 2 should have content"
        assert any("CHAPTER 2 CONTENT" in (b.get("content") or "") for b in blocks)
        print(f"✓ Chapter 2 has its content ({len(blocks)} blocks)")
    
    def test_06_add_more_content_chapter_1(self, headers):
        """Add more content to Chapter 1 to simulate real usage"""
        story_id = self.__class__.story_id
        chapter1_id = self.__class__.chapter1_id
        
        response = requests.post(
            f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter1_id}/append-blocks",
            json={"blocks": [{"type": "text", "content": "ADDITIONAL CHAPTER 1 CONTENT"}]},
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Added more content to Chapter 1")
    
    def test_07_verify_all_content_persists(self, headers):
        """Final verification: Both chapters have all their content"""
        story_id = self.__class__.story_id
        chapter1_id = self.__class__.chapter1_id
        chapter2_id = self.__class__.chapter2_id
        
        # Check Chapter 1
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter1_id}", headers=headers)
        assert response.status_code == 200
        ch1_blocks = response.json().get("content_blocks", [])
        assert len(ch1_blocks) >= 2, f"Chapter 1 should have at least 2 blocks, got {len(ch1_blocks)}"
        
        # Check Chapter 2
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter2_id}", headers=headers)
        assert response.status_code == 200
        ch2_blocks = response.json().get("content_blocks", [])
        assert len(ch2_blocks) >= 1, f"Chapter 2 should have at least 1 block, got {len(ch2_blocks)}"
        
        print(f"✓ FINAL VERIFICATION: Chapter 1 has {len(ch1_blocks)} blocks, Chapter 2 has {len(ch2_blocks)} blocks")


class TestPDFPreview(TestAuth):
    """Test PDF Preview Endpoints"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_story(self, headers):
        """Create a story with content for PDF preview"""
        # Create story
        response = requests.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_PDF_Preview_Story",
            "description": "Testing PDF preview"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.story_id = response.json()["id"]
        
        # Create chapter with content
        response = requests.post(f"{BASE_URL}/api/stories/{self.__class__.story_id}/chapters", json={
            "name": "Test Chapter"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.chapter_id = response.json()["id"]
        
        # Add content
        requests.post(
            f"{BASE_URL}/api/stories/{self.__class__.story_id}/chapters/{self.__class__.chapter_id}/append-blocks",
            json={"blocks": [{"type": "text", "content": "Content for PDF preview testing."}]},
            headers=headers
        )
        
        yield
        requests.delete(f"{BASE_URL}/api/stories/{self.__class__.story_id}", headers=headers)
    
    def test_chapter_pdf_preview(self, auth_token, headers):
        """Test chapter PDF preview endpoint"""
        story_id = self.__class__.story_id
        chapter_id = self.__class__.chapter_id
        
        response = requests.get(
            f"{BASE_URL}/api/stories/{story_id}/preview-pdf?chapter_id={chapter_id}&token={auth_token}",
            headers=headers
        )
        # PDF endpoint should return 200 with application/pdf
        assert response.status_code == 200, f"Chapter PDF preview failed: {response.text}"
        assert "application/pdf" in response.headers.get("content-type", "")
        print(f"✓ Chapter PDF preview works (returned {len(response.content)} bytes)")
    
    def test_full_story_pdf_preview(self, auth_token, headers):
        """Test full story PDF preview endpoint"""
        story_id = self.__class__.story_id
        
        response = requests.get(
            f"{BASE_URL}/api/stories/{story_id}/preview-pdf?token={auth_token}",
            headers=headers
        )
        assert response.status_code == 200, f"Story PDF preview failed: {response.text}"
        assert "application/pdf" in response.headers.get("content-type", "")
        print(f"✓ Full story PDF preview works (returned {len(response.content)} bytes)")


class TestContentBlockEditing(TestAuth):
    """Test inline edit and delete content blocks"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_story(self, headers):
        """Create a story with content for editing tests"""
        response = requests.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_Content_Block_Editing",
            "description": "Testing content block editing"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.story_id = response.json()["id"]
        
        response = requests.post(f"{BASE_URL}/api/stories/{self.__class__.story_id}/chapters", json={
            "name": "Edit Test Chapter"
        }, headers=headers)
        assert response.status_code == 200
        self.__class__.chapter_id = response.json()["id"]
        
        # Add multiple content blocks
        requests.post(
            f"{BASE_URL}/api/stories/{self.__class__.story_id}/chapters/{self.__class__.chapter_id}/append-blocks",
            json={"blocks": [
                {"type": "text", "content": "Block 1 - Original"},
                {"type": "text", "content": "Block 2 - To be edited"},
                {"type": "text", "content": "Block 3 - To be deleted"}
            ]},
            headers=headers
        )
        
        yield
        requests.delete(f"{BASE_URL}/api/stories/{self.__class__.story_id}", headers=headers)
    
    def test_inline_edit_content_block(self, headers):
        """Test editing a content block"""
        story_id = self.__class__.story_id
        chapter_id = self.__class__.chapter_id
        
        # Edit block at index 1
        response = requests.put(
            f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter_id}/blocks/1",
            json={"type": "text", "content": "Block 2 - EDITED CONTENT"},
            headers=headers
        )
        assert response.status_code == 200, f"Edit block failed: {response.text}"
        
        # Verify edit persisted
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter_id}", headers=headers)
        assert response.status_code == 200
        blocks = response.json().get("content_blocks", [])
        assert len(blocks) >= 2
        assert "EDITED CONTENT" in blocks[1].get("content", "")
        print(f"✓ Inline edit content block works")
    
    def test_delete_content_block(self, headers):
        """Test deleting a content block"""
        story_id = self.__class__.story_id
        chapter_id = self.__class__.chapter_id
        
        # Get initial count
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter_id}", headers=headers)
        initial_count = len(response.json().get("content_blocks", []))
        
        # Delete block at index 2
        response = requests.delete(
            f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter_id}/blocks/2",
            headers=headers
        )
        assert response.status_code == 200, f"Delete block failed: {response.text}"
        
        # Verify deletion
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}/chapters/{chapter_id}", headers=headers)
        assert response.status_code == 200
        blocks = response.json().get("content_blocks", [])
        assert len(blocks) == initial_count - 1
        print(f"✓ Delete content block works (blocks: {initial_count} -> {len(blocks)})")


class TestStoryDeletion(TestAuth):
    """Test story deletion"""
    
    def test_delete_story(self, headers):
        """Test deleting a story"""
        # Create a story to delete
        response = requests.post(f"{BASE_URL}/api/stories", json={
            "name": "TEST_Story_To_Delete",
            "description": "Will be deleted"
        }, headers=headers)
        assert response.status_code == 200
        story_id = response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/stories/{story_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify it's gone
        response = requests.get(f"{BASE_URL}/api/stories/{story_id}", headers=headers)
        assert response.status_code == 404
        print(f"✓ Story deletion works")


# Cleanup test data after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_stories():
    """Cleanup any remaining TEST_ prefixed stories after all tests"""
    yield
    try:
        # Get auth token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@archiva.com",
            "password": "test123"
        })
        if response.status_code != 200:
            return
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all stories
        response = requests.get(f"{BASE_URL}/api/stories", headers=headers)
        if response.status_code == 200:
            stories = response.json()
            for story in stories:
                if story.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/stories/{story['id']}", headers=headers)
                    print(f"Cleaned up: {story['name']}")
    except:
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
