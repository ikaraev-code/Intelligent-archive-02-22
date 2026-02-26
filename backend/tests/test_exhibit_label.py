"""
Test for Exhibit # label feature on media uploads in Stories

This test verifies that when uploading media to a story chapter,
an "Exhibit #" text label block is automatically added before the media block.
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExhibitLabel:
    """Test media upload with Exhibit # label"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@archiva.com", "password": "test123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create test story
        story_response = requests.post(
            f"{BASE_URL}/api/stories",
            json={"name": "Exhibit Test Story", "description": "Testing Exhibit labels"},
            headers=self.headers
        )
        assert story_response.status_code == 200, f"Story creation failed: {story_response.text}"
        self.story_id = story_response.json()["id"]
        
        # Create test chapter
        chapter_response = requests.post(
            f"{BASE_URL}/api/stories/{self.story_id}/chapters",
            json={"name": "Exhibit Test Chapter"},
            headers=self.headers
        )
        assert chapter_response.status_code == 200, f"Chapter creation failed: {chapter_response.text}"
        self.chapter_id = chapter_response.json()["id"]
        
        yield
        
        # Cleanup - delete story
        requests.delete(f"{BASE_URL}/api/stories/{self.story_id}", headers=self.headers)
    
    def test_first_media_upload_adds_exhibit_1_label(self):
        """Test that first media upload adds 'Exhibit 1' label before the media block"""
        
        # Create a simple test image file
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            # Write minimal PNG header (1x1 pixel transparent PNG)
            f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
            test_file_path = f.name
        
        try:
            # Upload media to chapter
            with open(test_file_path, 'rb') as f:
                files = {'file': ('test_image.png', f, 'image/png')}
                data = {'caption': 'Test Image Caption'}
                upload_response = requests.post(
                    f"{BASE_URL}/api/stories/{self.story_id}/chapters/{self.chapter_id}/media",
                    files=files,
                    data=data,
                    headers=self.headers
                )
            
            assert upload_response.status_code == 200, f"Media upload failed: {upload_response.text}"
            print(f"Media upload response: {upload_response.json()}")
            
            # Get chapter to verify content blocks
            chapter_response = requests.get(
                f"{BASE_URL}/api/stories/{self.story_id}/chapters/{self.chapter_id}",
                headers=self.headers
            )
            assert chapter_response.status_code == 200
            
            chapter_data = chapter_response.json()
            content_blocks = chapter_data.get("content_blocks", [])
            
            print(f"Content blocks after first upload: {content_blocks}")
            
            # Should have 2 blocks: Exhibit label + media
            assert len(content_blocks) >= 2, f"Expected at least 2 content blocks, got {len(content_blocks)}"
            
            # First block should be text with "Exhibit 1"
            exhibit_block = content_blocks[0]
            assert exhibit_block["type"] == "text", f"First block should be text, got {exhibit_block['type']}"
            assert "Exhibit 1" in exhibit_block["content"], f"First block should contain 'Exhibit 1', got: {exhibit_block['content']}"
            
            # Second block should be image
            media_block = content_blocks[1]
            assert media_block["type"] == "image", f"Second block should be image, got {media_block['type']}"
            
            print("✅ First media upload correctly added 'Exhibit 1' label")
            
        finally:
            os.unlink(test_file_path)
    
    def test_second_media_upload_adds_exhibit_2_label(self):
        """Test that second media upload adds 'Exhibit 2' label"""
        
        # Create two test image files
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
            test_file_1 = f.name
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
            test_file_2 = f.name
        
        try:
            # Upload first media
            with open(test_file_1, 'rb') as f:
                files = {'file': ('image1.png', f, 'image/png')}
                requests.post(
                    f"{BASE_URL}/api/stories/{self.story_id}/chapters/{self.chapter_id}/media",
                    files=files,
                    data={'caption': 'Image 1'},
                    headers=self.headers
                )
            
            # Upload second media
            with open(test_file_2, 'rb') as f:
                files = {'file': ('image2.png', f, 'image/png')}
                upload_response = requests.post(
                    f"{BASE_URL}/api/stories/{self.story_id}/chapters/{self.chapter_id}/media",
                    files=files,
                    data={'caption': 'Image 2'},
                    headers=self.headers
                )
            
            assert upload_response.status_code == 200
            
            # Get chapter to verify content blocks
            chapter_response = requests.get(
                f"{BASE_URL}/api/stories/{self.story_id}/chapters/{self.chapter_id}",
                headers=self.headers
            )
            chapter_data = chapter_response.json()
            content_blocks = chapter_data.get("content_blocks", [])
            
            print(f"Content blocks after two uploads: {content_blocks}")
            
            # Should have 4 blocks: Exhibit 1 label + media1 + Exhibit 2 label + media2
            assert len(content_blocks) >= 4, f"Expected at least 4 content blocks, got {len(content_blocks)}"
            
            # Find Exhibit 1 and Exhibit 2 labels
            exhibit_labels = [b for b in content_blocks if b["type"] == "text" and "Exhibit" in b.get("content", "")]
            assert len(exhibit_labels) >= 2, f"Expected 2 exhibit labels, found {len(exhibit_labels)}"
            
            exhibit_texts = [b["content"] for b in exhibit_labels]
            assert any("Exhibit 1" in t for t in exhibit_texts), "Should have 'Exhibit 1' label"
            assert any("Exhibit 2" in t for t in exhibit_texts), "Should have 'Exhibit 2' label"
            
            print("✅ Second media upload correctly added 'Exhibit 2' label")
            
        finally:
            os.unlink(test_file_1)
            os.unlink(test_file_2)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
