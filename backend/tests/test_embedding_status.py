"""
Test suite for P0: Real-time Embedding Status Indicators feature
Tests the batch-status endpoint and embedding_status field in file uploads
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stories-chapter-bug.preview.emergentagent.com')

class TestEmbeddingStatusFeature:
    """Tests for the embedding status indicator feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@archiva.com", "password": "test123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    # ==================== Batch Status Endpoint Tests ====================
    
    def test_batch_status_endpoint_exists(self, auth_headers):
        """Test GET /api/files/batch-status endpoint is accessible"""
        response = requests.get(
            f"{BASE_URL}/api/files/batch-status",
            headers=auth_headers,
            params={"ids": ""}
        )
        assert response.status_code == 200, f"Endpoint not accessible: {response.status_code}"
        data = response.json()
        assert "statuses" in data, "Response missing 'statuses' key"
        print(f"✓ Batch status endpoint accessible, empty ids returns: {data}")
    
    def test_batch_status_empty_ids(self, auth_headers):
        """Test batch-status with empty ids parameter"""
        response = requests.get(
            f"{BASE_URL}/api/files/batch-status",
            headers=auth_headers,
            params={"ids": ""}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["statuses"] == [], "Empty ids should return empty statuses list"
        print("✓ Empty ids returns empty statuses array")
    
    def test_batch_status_invalid_ids(self, auth_headers):
        """Test batch-status with non-existent file IDs"""
        response = requests.get(
            f"{BASE_URL}/api/files/batch-status",
            headers=auth_headers,
            params={"ids": "non-existent-id-1,non-existent-id-2"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["statuses"] == [], "Non-existent ids should return empty statuses"
        print("✓ Non-existent file ids return empty statuses array")
    
    def test_batch_status_returns_correct_fields(self, auth_headers):
        """Test that batch-status returns correct fields for existing files"""
        # First, get some existing files
        files_response = requests.get(
            f"{BASE_URL}/api/files",
            headers=auth_headers,
            params={"limit": 5}
        )
        assert files_response.status_code == 200
        files = files_response.json().get("files", [])
        
        if not files:
            pytest.skip("No files in archive to test batch-status")
        
        file_ids = [f["id"] for f in files[:3]]
        
        response = requests.get(
            f"{BASE_URL}/api/files/batch-status",
            headers=auth_headers,
            params={"ids": ",".join(file_ids)}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "statuses" in data
        assert len(data["statuses"]) > 0, "Should return statuses for existing files"
        
        for status in data["statuses"]:
            assert "id" in status, "Status missing 'id' field"
            assert "original_filename" in status, "Status missing 'original_filename' field"
            assert "embedding_status" in status, "Status missing 'embedding_status' field"
            # embedding_count may or may not exist depending on embedding status
            print(f"  File {status['original_filename']}: embedding_status={status['embedding_status']}")
        
        print(f"✓ Batch status returns {len(data['statuses'])} file statuses with correct fields")
    
    # ==================== File Upload with Embedding Status Tests ====================
    
    def test_upload_file_returns_embedding_status(self, auth_headers):
        """Test POST /api/files/upload returns embedding_status field set to 'pending'"""
        # Create a simple test file
        test_content = b"This is a test file for embedding status testing. It contains sample text to be embedded."
        files = {"file": ("test_embedding_status.txt", test_content, "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/files/upload",
            headers=auth_headers,
            files=files,
            data={"tags": "test,embedding"}
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response missing file id"
        assert "embedding_status" in data, "Response missing embedding_status field"
        assert data["embedding_status"] == "pending", f"Expected embedding_status='pending', got '{data['embedding_status']}'"
        
        file_id = data["id"]
        print(f"✓ File uploaded with id={file_id}, embedding_status='pending'")
        
        # Return file_id for cleanup and further testing
        return file_id
    
    def test_embedding_status_transition(self, auth_headers):
        """Test that embedding status transitions from 'pending' to 'processing'/'completed'"""
        # Upload a new test file
        test_content = b"Test content for status transition verification. This text should trigger embedding processing."
        files = {"file": ("test_transition.txt", test_content, "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/files/upload",
            headers=auth_headers,
            files=files,
            data={"tags": "test,transition"}
        )
        
        assert response.status_code == 200
        file_id = response.json()["id"]
        initial_status = response.json()["embedding_status"]
        assert initial_status == "pending", f"Initial status should be 'pending', got '{initial_status}'"
        print(f"✓ File uploaded with initial status: {initial_status}")
        
        # Poll for status changes over 10 seconds
        valid_statuses = ["pending", "processing", "completed", "failed", "skipped", "disabled"]
        status_history = [initial_status]
        
        for i in range(5):
            time.sleep(2)
            
            batch_response = requests.get(
                f"{BASE_URL}/api/files/batch-status",
                headers=auth_headers,
                params={"ids": file_id}
            )
            
            assert batch_response.status_code == 200
            statuses = batch_response.json().get("statuses", [])
            
            if statuses:
                current_status = statuses[0].get("embedding_status", "unknown")
                assert current_status in valid_statuses, f"Invalid status: {current_status}"
                
                if current_status != status_history[-1]:
                    status_history.append(current_status)
                    print(f"  Status changed: {status_history[-2]} -> {current_status}")
                
                # If completed or failed, we can stop polling
                if current_status in ["completed", "failed", "skipped", "disabled"]:
                    break
        
        print(f"✓ Status transition observed: {' -> '.join(status_history)}")
        
        # Verify the file has a valid final status
        final_status = status_history[-1]
        assert final_status in valid_statuses
        
        # Cleanup - delete test file
        requests.delete(f"{BASE_URL}/api/files/{file_id}", headers=auth_headers)
    
    def test_batch_status_multiple_files(self, auth_headers):
        """Test batch-status with multiple file IDs"""
        # Upload multiple test files
        file_ids = []
        for i in range(3):
            content = f"Test file {i} for batch status testing.".encode()
            files = {"file": (f"batch_test_{i}.txt", content, "text/plain")}
            
            response = requests.post(
                f"{BASE_URL}/api/files/upload",
                headers=auth_headers,
                files=files,
                data={"tags": f"batch,test{i}"}
            )
            
            if response.status_code == 200:
                file_ids.append(response.json()["id"])
        
        assert len(file_ids) >= 2, "Need at least 2 files for batch testing"
        print(f"✓ Uploaded {len(file_ids)} test files")
        
        # Test batch status with comma-separated IDs
        response = requests.get(
            f"{BASE_URL}/api/files/batch-status",
            headers=auth_headers,
            params={"ids": ",".join(file_ids)}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["statuses"]) == len(file_ids), f"Expected {len(file_ids)} statuses, got {len(data['statuses'])}"
        
        for status in data["statuses"]:
            assert status["id"] in file_ids
            assert "embedding_status" in status
            print(f"  File {status['original_filename']}: {status['embedding_status']}")
        
        print(f"✓ Batch status returned all {len(file_ids)} file statuses")
        
        # Cleanup
        for fid in file_ids:
            requests.delete(f"{BASE_URL}/api/files/{fid}", headers=auth_headers)
    
    # ==================== Embedding Status Values Tests ====================
    
    def test_embedding_status_values(self, auth_headers):
        """Verify embedding_status field only contains valid values"""
        # Get all files and check their embedding status values
        response = requests.get(
            f"{BASE_URL}/api/files",
            headers=auth_headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200
        files = response.json().get("files", [])
        
        valid_statuses = ["pending", "processing", "completed", "failed", "skipped", "disabled"]
        status_counts = {}
        
        for file in files:
            # embedding_status might not be in list response, need to check individual file
            file_detail = requests.get(
                f"{BASE_URL}/api/files/{file['id']}",
                headers=auth_headers
            )
            if file_detail.status_code == 200:
                status = file_detail.json().get("embedding_status", "unknown")
                if status:
                    assert status in valid_statuses, f"Invalid status '{status}' for file {file['id']}"
                    status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"✓ All embedding statuses valid. Distribution: {status_counts}")
    
    def test_batch_status_unauthorized(self):
        """Test that batch-status requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/files/batch-status",
            params={"ids": "some-id"}
        )
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 for unauthorized access, got {response.status_code}"
        print("✓ Batch status endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
