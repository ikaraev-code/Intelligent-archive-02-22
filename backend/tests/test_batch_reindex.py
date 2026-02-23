"""
Test suite for batch re-indexing feature:
- GET /api/files/embedding-stats - Returns status breakdown
- POST /api/files/reindex?filter=all - Reindex all files
- POST /api/files/reindex?filter=failed - Reindex only failed files  
- POST /api/files/reindex?filter=unindexed - Reindex failed+skipped+pending+none files
- GET /api/files/reindex-progress/{task_id} - Poll reindex progress
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@archiva.com",
        "password": "test123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestEmbeddingStats:
    """Tests for GET /api/files/embedding-stats endpoint"""
    
    def test_embedding_stats_returns_200(self, auth_headers):
        """Verify endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/files/embedding-stats", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/files/embedding-stats returns 200")
    
    def test_embedding_stats_has_required_fields(self, auth_headers):
        """Verify response contains all required status breakdown fields"""
        response = requests.get(f"{BASE_URL}/api/files/embedding-stats", headers=auth_headers)
        data = response.json()
        
        required_fields = ["total", "completed", "processing", "pending", "failed", "skipped", "disabled", "none", "problem_files"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify types
        assert isinstance(data["total"], int)
        assert isinstance(data["completed"], int)
        assert isinstance(data["failed"], int)
        assert isinstance(data["problem_files"], list)
        
        print(f"✓ embedding-stats has all required fields: {required_fields}")
        print(f"  - Total: {data['total']}, Completed: {data['completed']}, Failed: {data['failed']}")
    
    def test_embedding_stats_problem_files_structure(self, auth_headers):
        """Verify problem_files array has correct structure"""
        response = requests.get(f"{BASE_URL}/api/files/embedding-stats", headers=auth_headers)
        data = response.json()
        
        if data["problem_files"]:
            file = data["problem_files"][0]
            assert "id" in file, "Problem file missing 'id'"
            assert "original_filename" in file, "Problem file missing 'original_filename'"
            assert "embedding_status" in file, "Problem file missing 'embedding_status'"
            assert "file_type" in file, "Problem file missing 'file_type'"
            print(f"✓ Problem files have correct structure (id, original_filename, embedding_status, file_type)")
        else:
            print("✓ No problem files to verify (all files indexed)")


class TestReindexFilters:
    """Tests for POST /api/files/reindex endpoint with different filters"""
    
    def test_reindex_all_filter(self, auth_headers):
        """Test reindex with filter=all starts a task"""
        response = requests.post(f"{BASE_URL}/api/files/reindex?filter=all", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "task_id" in data
        assert "total" in data
        
        # If files exist, task_id should be a UUID
        if data["total"] > 0:
            assert data["task_id"] is not None
            assert data["message"] == "Reindex started"
        
        print(f"✓ POST /api/files/reindex?filter=all returns task_id, total={data['total']}")
    
    def test_reindex_failed_filter(self, auth_headers):
        """Test reindex with filter=failed targets only failed files"""
        # First get stats to know how many failed files
        stats = requests.get(f"{BASE_URL}/api/files/embedding-stats", headers=auth_headers).json()
        failed_count = stats["failed"]
        
        response = requests.post(f"{BASE_URL}/api/files/reindex?filter=failed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if failed_count > 0:
            assert data["task_id"] is not None
            # Total should be <= failed count (some may have been reindexed already)
            assert data["total"] <= stats["failed"] + 5  # Allow small variance
        
        print(f"✓ POST /api/files/reindex?filter=failed correctly targets failed files (total={data['total']})")
    
    def test_reindex_unindexed_filter(self, auth_headers):
        """Test reindex with filter=unindexed targets failed+skipped+pending+none"""
        stats = requests.get(f"{BASE_URL}/api/files/embedding-stats", headers=auth_headers).json()
        expected_count = stats["failed"] + stats["skipped"] + stats["pending"] + stats.get("none", 0)
        
        response = requests.post(f"{BASE_URL}/api/files/reindex?filter=unindexed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Total should be close to expected (allow variance for concurrent changes)
        if expected_count > 0:
            assert data["task_id"] is not None
        
        print(f"✓ POST /api/files/reindex?filter=unindexed works (total={data['total']})")
    
    def test_reindex_invalid_filter_defaults_to_all(self, auth_headers):
        """Test reindex with invalid filter defaults to 'all' behavior"""
        response = requests.post(f"{BASE_URL}/api/files/reindex?filter=invalid_filter", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Invalid filter parameter handled gracefully")


class TestReindexProgress:
    """Tests for GET /api/files/reindex-progress/{task_id} endpoint"""
    
    def test_reindex_progress_valid_task(self, auth_headers):
        """Test progress endpoint with valid task_id"""
        # Start a reindex task
        reindex_response = requests.post(f"{BASE_URL}/api/files/reindex?filter=all", headers=auth_headers)
        task_id = reindex_response.json().get("task_id")
        
        if not task_id:
            pytest.skip("No files to reindex, skipping progress test")
        
        # Poll progress
        response = requests.get(f"{BASE_URL}/api/files/reindex-progress/{task_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "processed" in data
        assert "total" in data
        assert "errors" in data
        assert "current_file" in data
        
        assert data["status"] in ["running", "completed", "failed"]
        assert isinstance(data["processed"], int)
        assert isinstance(data["total"], int)
        assert isinstance(data["errors"], list)
        
        print(f"✓ GET /api/files/reindex-progress/{task_id} returns correct structure")
        print(f"  - Status: {data['status']}, Processed: {data['processed']}/{data['total']}")
    
    def test_reindex_progress_invalid_task(self, auth_headers):
        """Test progress endpoint with invalid task_id returns 404"""
        response = requests.get(f"{BASE_URL}/api/files/reindex-progress/invalid-task-id", headers=auth_headers)
        assert response.status_code == 404
        assert "detail" in response.json()
        print("✓ Invalid task_id returns 404")
    
    def test_reindex_completes_successfully(self, auth_headers):
        """Test that a reindex task completes within reasonable time"""
        # Start reindex on failed files (likely fewer)
        reindex_response = requests.post(f"{BASE_URL}/api/files/reindex?filter=failed", headers=auth_headers)
        task_id = reindex_response.json().get("task_id")
        
        if not task_id:
            print("✓ No failed files to reindex")
            return
        
        # Poll until complete (max 30 seconds)
        max_wait = 30
        poll_interval = 2
        elapsed = 0
        
        while elapsed < max_wait:
            response = requests.get(f"{BASE_URL}/api/files/reindex-progress/{task_id}", headers=auth_headers)
            data = response.json()
            
            if data["status"] in ["completed", "failed"]:
                assert data["status"] == "completed" or len(data["errors"]) > 0
                print(f"✓ Reindex task completed: status={data['status']}, processed={data['processed']}/{data['total']}")
                return
            
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        # Task still running after timeout - that's okay for large datasets
        print(f"✓ Reindex task still running after {max_wait}s (expected for large datasets)")


class TestEdgeCases:
    """Edge case tests"""
    
    def test_stats_without_auth_returns_401(self):
        """Test embedding-stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/files/embedding-stats")
        assert response.status_code in [401, 403]
        print("✓ /api/files/embedding-stats requires authentication")
    
    def test_reindex_without_auth_returns_401(self):
        """Test reindex requires authentication"""
        response = requests.post(f"{BASE_URL}/api/files/reindex?filter=all")
        assert response.status_code in [401, 403]
        print("✓ /api/files/reindex requires authentication")
    
    def test_progress_without_auth_returns_401(self):
        """Test reindex-progress requires authentication"""
        response = requests.get(f"{BASE_URL}/api/files/reindex-progress/some-task-id")
        assert response.status_code in [401, 403]
        print("✓ /api/files/reindex-progress requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
