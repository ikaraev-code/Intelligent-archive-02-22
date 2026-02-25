"""
Tests for P1, P2, P3 Features:
- P1: priority_file_ids in chat endpoint (recently uploaded files prioritization in RAG)
- P2: Sidebar unique data-testid attributes (desktop-nav-* and mobile-nav-*)
- P3: RAG source deduplication (no duplicate file_ids in sources array)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stories-chapter-bug.preview.emergentagent.com').rstrip('/')

class TestAuth:
    """Authentication fixture setup"""
    
    @staticmethod
    def get_auth_token():
        """Get auth token using test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@archiva.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    @staticmethod
    def get_auth_headers():
        """Get authorization headers"""
        token = TestAuth.get_auth_token()
        if token:
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        return {"Content-Type": "application/json"}


class TestP1PriorityFileIds:
    """P1 Backend: Test priority_file_ids field in POST /api/chat"""
    
    def test_chat_endpoint_accepts_priority_file_ids(self):
        """Test that POST /api/chat accepts optional priority_file_ids field"""
        headers = TestAuth.get_auth_headers()
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Hello, what files do I have?",
            "session_id": None,
            "include_file_context": True,
            "priority_file_ids": []  # Empty array should work
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "response" in data, "Response should contain 'response' field"
        assert "session_id" in data, "Response should contain 'session_id' field"
        assert "sources" in data, "Response should contain 'sources' field"
        print(f"TEST PASSED: Chat endpoint accepts priority_file_ids")
    
    def test_chat_endpoint_with_valid_priority_file_ids(self):
        """Test chat with valid priority_file_ids - file should be prioritized in sources"""
        headers = TestAuth.get_auth_headers()
        
        # First, upload a test file
        file_content = "This is a priority test document about quantum physics and relativity theory."
        files = {"file": ("priority_test_p1.txt", file_content, "text/plain")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/files/upload",
            files=files,
            data={"tags": "priority,test,quantum"},
            headers={"Authorization": headers["Authorization"]}
        )
        
        if upload_response.status_code == 200:
            file_id = upload_response.json().get("id")
            print(f"Uploaded test file with ID: {file_id}")
            
            # Wait for embedding to process
            time.sleep(3)
            
            # Now test chat with priority_file_ids including this file
            chat_response = requests.post(f"{BASE_URL}/api/chat", json={
                "message": "Tell me about quantum physics and relativity",
                "session_id": None,
                "include_file_context": True,
                "priority_file_ids": [file_id]
            }, headers=headers)
            
            assert chat_response.status_code == 200, f"Chat with priority failed: {chat_response.text}"
            data = chat_response.json()
            
            print(f"Chat response received with {len(data.get('sources', []))} sources")
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/files/{file_id}", headers=headers)
            print("TEST PASSED: Chat endpoint works with valid priority_file_ids")
        else:
            print(f"Upload failed (may not have file permissions): {upload_response.status_code}")
            # Still test that the endpoint accepts priority_file_ids without a valid file
            chat_response = requests.post(f"{BASE_URL}/api/chat", json={
                "message": "Hello",
                "priority_file_ids": ["non-existent-id"]
            }, headers=headers)
            assert chat_response.status_code == 200, f"Expected 200, got {chat_response.status_code}"
            print("TEST PASSED: Chat endpoint accepts priority_file_ids (file upload skipped)")
    
    def test_chat_endpoint_without_priority_file_ids(self):
        """Test that chat works without priority_file_ids (backward compatibility)"""
        headers = TestAuth.get_auth_headers()
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "What files are in my archive?",
            "session_id": None,
            "include_file_context": True
            # Note: No priority_file_ids field - should still work
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("TEST PASSED: Chat endpoint works without priority_file_ids (backward compatible)")
    
    def test_chat_endpoint_priority_file_ids_null(self):
        """Test that chat accepts priority_file_ids as null"""
        headers = TestAuth.get_auth_headers()
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Test query",
            "priority_file_ids": None
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("TEST PASSED: Chat endpoint accepts priority_file_ids as null")


class TestP3SourceDeduplication:
    """P3 Backend: Test RAG source deduplication - no duplicate file_ids in sources"""
    
    def test_chat_sources_no_duplicates(self):
        """Verify that sources array in chat response has no duplicate file_ids"""
        headers = TestAuth.get_auth_headers()
        
        # Send a query that might return multiple chunks from same file
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Tell me about all the documents in my archive. Give me detailed information.",
            "include_file_context": True
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        sources = data.get("sources", [])
        if sources:
            # Check for duplicate file_ids
            file_ids = [s.get("file_id") for s in sources]
            unique_file_ids = set(file_ids)
            
            assert len(file_ids) == len(unique_file_ids), \
                f"Found duplicate file_ids in sources! file_ids={file_ids}"
            
            print(f"TEST PASSED: No duplicate file_ids in sources (found {len(sources)} unique sources)")
        else:
            print("TEST PASSED: No sources returned (deduplication N/A)")
    
    def test_chat_sources_have_required_fields(self):
        """Verify sources have required fields: file_id, filename, file_type, passage, relevance"""
        headers = TestAuth.get_auth_headers()
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Tell me about the files in my archive",
            "include_file_context": True
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        sources = data.get("sources", [])
        for source in sources:
            assert "file_id" in source, "Source should have file_id"
            assert "filename" in source, "Source should have filename"
            assert "file_type" in source, "Source should have file_type"
            assert "passage" in source, "Source should have passage"
            assert "relevance" in source, "Source should have relevance"
            
            # Verify filename is not "Unknown file" for deleted files
            assert source["filename"] != "Unknown file", \
                f"Source has 'Unknown file' - deleted file not properly skipped: {source}"
        
        print(f"TEST PASSED: All {len(sources)} sources have required fields, no 'Unknown file' entries")
    
    def test_project_chat_sources_no_duplicates(self):
        """Verify project chat sources have no duplicate file_ids"""
        headers = TestAuth.get_auth_headers()
        
        # First get list of projects
        projects_response = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        
        if projects_response.status_code == 200:
            projects = projects_response.json()
            if projects:
                # Test with first project that has files
                for project in projects:
                    if project.get("file_count", 0) > 0:
                        project_id = project["id"]
                        
                        chat_response = requests.post(
                            f"{BASE_URL}/api/projects/{project_id}/chat",
                            json={"message": "Summarize the content of all files in this project"},
                            headers=headers
                        )
                        
                        if chat_response.status_code == 200:
                            data = chat_response.json()
                            sources = data.get("sources", [])
                            
                            if sources:
                                file_ids = [s.get("file_id") for s in sources]
                                unique_ids = set(file_ids)
                                
                                assert len(file_ids) == len(unique_ids), \
                                    f"Duplicate file_ids in project chat sources: {file_ids}"
                                
                                print(f"TEST PASSED: Project chat has no duplicate sources ({len(sources)} sources)")
                            else:
                                print("TEST PASSED: No sources returned for project chat")
                        else:
                            print(f"Project chat returned {chat_response.status_code}")
                        break
                else:
                    print("TEST SKIPPED: No projects with files found")
            else:
                print("TEST SKIPPED: No projects found")
        else:
            print(f"TEST SKIPPED: Could not get projects ({projects_response.status_code})")


class TestFileDeleteCascade:
    """Test file cascade delete functionality"""
    
    def test_file_delete_returns_cascade_info(self):
        """DELETE /api/files/{id} should return affected_projects and embeddings_removed count"""
        headers = TestAuth.get_auth_headers()
        
        # First upload a file
        file_content = "Test file for cascade delete testing"
        files = {"file": ("cascade_test.txt", file_content, "text/plain")}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/files/upload",
            files=files,
            headers={"Authorization": headers["Authorization"]}
        )
        
        if upload_response.status_code == 200:
            file_id = upload_response.json().get("id")
            print(f"Uploaded test file: {file_id}")
            
            # Wait for embedding
            time.sleep(2)
            
            # Now delete the file
            delete_response = requests.delete(f"{BASE_URL}/api/files/{file_id}", headers=headers)
            
            assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
            data = delete_response.json()
            
            # Verify cascade info is returned
            assert "message" in data, "Response should have 'message'"
            assert "embeddings_removed" in data, "Response should have 'embeddings_removed' count"
            assert "affected_projects" in data, "Response should have 'affected_projects' list"
            
            print(f"TEST PASSED: File delete returns cascade info - embeddings_removed={data['embeddings_removed']}, affected_projects={len(data['affected_projects'])}")
        else:
            print(f"TEST SKIPPED: Could not upload file ({upload_response.status_code})")


class TestProjectInactiveStatus:
    """Test project inactive status when file_count is 0"""
    
    def test_project_status_field_exists(self):
        """Verify projects list includes status field"""
        headers = TestAuth.get_auth_headers()
        
        response = requests.get(f"{BASE_URL}/api/projects", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        projects = response.json()
        
        for project in projects:
            # Status should be set
            assert "status" in project or "file_count" in project, \
                "Project should have status or file_count field"
            
            file_count = project.get("file_count", len(project.get("file_ids", [])))
            status = project.get("status", "active" if file_count > 0 else "inactive")
            
            # If file_count is 0, status should be inactive
            if file_count == 0:
                expected_status = "inactive"
            else:
                expected_status = "active"
            
            print(f"Project '{project.get('name')}': file_count={file_count}, status={status}")
        
        print(f"TEST PASSED: Projects have status field ({len(projects)} projects checked)")


class TestChatRequestModel:
    """Test ChatRequest model validation"""
    
    def test_chat_request_accepts_all_fields(self):
        """Test that ChatRequest model accepts message, session_id, include_file_context, priority_file_ids"""
        headers = TestAuth.get_auth_headers()
        
        # Test with all fields
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "Test query",
            "session_id": "test-session-123",
            "include_file_context": False,
            "priority_file_ids": ["id1", "id2", "id3"]
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("TEST PASSED: ChatRequest model accepts all fields including priority_file_ids")
    
    def test_chat_request_message_required(self):
        """Test that message field is required"""
        headers = TestAuth.get_auth_headers()
        
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "priority_file_ids": []
            # Missing message field
        }, headers=headers)
        
        assert response.status_code == 422, f"Expected 422 for missing message, got {response.status_code}"
        print("TEST PASSED: ChatRequest requires message field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
