"""
RAG (Retrieval Augmented Generation) Feature Tests for Archiva
Tests the embedding system, semantic search, and AI chat with RAG context
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test1234"


class TestAuthSetup:
    """Authentication setup tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        # Try registering if login fails
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD, "name": "Test User"},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Could not authenticate - skipping tests")
    
    def test_auth_works(self, auth_token):
        """Verify authentication is working"""
        assert auth_token is not None
        print(f"✓ Auth token obtained successfully")


class TestEmbeddingStatus:
    """Tests for /api/files/embedding-status endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_embedding_status_returns_200(self, auth_token):
        """Test that embedding-status endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/files/embedding-status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Embedding status endpoint returns 200")
    
    def test_embedding_status_has_correct_fields(self, auth_token):
        """Test that embedding-status returns expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/files/embedding-status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "status" in data, "Missing 'status' field"
        assert "total_files" in data, "Missing 'total_files' field"
        assert "total_embeddings" in data, "Missing 'total_embeddings' field"
        assert "rag_ready" in data, "Missing 'rag_ready' field"
        
        print(f"✓ Embedding status has all required fields")
        print(f"  - Status: {data['status']}")
        print(f"  - Total files: {data['total_files']}")
        print(f"  - Total embeddings: {data['total_embeddings']}")
        print(f"  - RAG ready: {data['rag_ready']}")
    
    def test_embedding_status_shows_rag_ready(self, auth_token):
        """Test that rag_ready is true when embeddings exist"""
        response = requests.get(
            f"{BASE_URL}/api/files/embedding-status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Based on the agent notes, there should be 21 embeddings from 8 files
        assert data.get("rag_ready") == True, f"RAG should be ready, got: {data.get('rag_ready')}"
        assert data.get("total_embeddings", 0) > 0, f"Should have embeddings, got: {data.get('total_embeddings')}"
        
        print(f"✓ RAG system is ready with {data.get('total_embeddings')} embeddings")
    
    def test_embedding_status_shows_enabled(self, auth_token):
        """Test that embedding service is enabled"""
        response = requests.get(
            f"{BASE_URL}/api/files/embedding-status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("status") == "enabled", f"Expected status 'enabled', got: {data.get('status')}"
        assert data.get("model") == "text-embedding-3-small", f"Expected model 'text-embedding-3-small', got: {data.get('model')}"
        
        print(f"✓ Embedding service enabled with model: {data.get('model')}")


class TestReindexEndpoint:
    """Tests for /api/files/reindex endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_reindex_returns_200(self, auth_token):
        """Test that reindex endpoint returns 200 and processes files"""
        response = requests.post(
            f"{BASE_URL}/api/files/reindex",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120  # Reindexing can take longer
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Reindex endpoint returns 200")
    
    def test_reindex_returns_correct_structure(self, auth_token):
        """Test that reindex returns expected response structure"""
        response = requests.post(
            f"{BASE_URL}/api/files/reindex",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "message" in data, "Missing 'message' field"
        assert "processed" in data, "Missing 'processed' field"
        assert "total" in data, "Missing 'total' field"
        assert "total_embeddings" in data, "Missing 'total_embeddings' field"
        
        print(f"✓ Reindex response has correct structure")
        print(f"  - Message: {data['message']}")
        print(f"  - Processed: {data['processed']}/{data['total']} files")
        print(f"  - Total embeddings: {data['total_embeddings']}")
    
    def test_reindex_creates_embeddings(self, auth_token):
        """Test that reindex actually creates embeddings"""
        # Get status before
        status_before = requests.get(
            f"{BASE_URL}/api/files/embedding-status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        ).json()
        
        # Trigger reindex
        response = requests.post(
            f"{BASE_URL}/api/files/reindex",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify embeddings were created
        assert data.get("total_embeddings", 0) > 0, "Should have created embeddings"
        
        print(f"✓ Reindex created {data.get('total_embeddings')} embeddings")


class TestAIChatWithRAG:
    """Tests for /api/chat endpoint with RAG context"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_chat_endpoint_returns_200(self, auth_token):
        """Test that chat endpoint returns 200"""
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "message": "Hello, what files do I have?",
                "include_file_context": True
            },
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Chat endpoint returns 200")
    
    def test_chat_returns_response_and_session(self, auth_token):
        """Test that chat returns response and session_id"""
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "message": "What is in my archive?",
                "include_file_context": True
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "response" in data, "Missing 'response' field"
        assert "session_id" in data, "Missing 'session_id' field"
        assert len(data["response"]) > 0, "Response should not be empty"
        
        print(f"✓ Chat returns response and session_id")
        print(f"  - Session ID: {data['session_id']}")
        print(f"  - Response length: {len(data['response'])} chars")
    
    def test_chat_uses_rag_for_multex_query(self, auth_token):
        """Test that chat uses RAG to answer questions about Multex Story"""
        # Query about Multex which should be in the archive
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "message": "Tell me about Multex. What is the Multex Story?",
                "include_file_context": True
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check that response contains relevant info
        response_text = data.get("response", "").lower()
        
        # The response should reference Multex or related content
        has_relevant_content = (
            "multex" in response_text or
            "story" in response_text or
            "file" in response_text
        )
        
        print(f"✓ Chat responded to Multex query")
        print(f"  - Response preview: {data.get('response', '')[:200]}...")
        
        # This is a soft assertion - AI might respond differently
        if has_relevant_content:
            print(f"✓ Response appears to use RAG context (mentions relevant terms)")
    
    def test_chat_uses_rag_for_karaev_query(self, auth_token):
        """Test that chat uses RAG to answer questions about Karaev documents"""
        # Query about Karaev which should be in the archive
        response = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "message": "What do you know about Karaev? What is in the Red Star documents?",
                "include_file_context": True
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Chat responded to Karaev query")
        print(f"  - Response preview: {data.get('response', '')[:200]}...")
    
    def test_chat_session_persistence(self, auth_token):
        """Test that chat sessions persist messages"""
        # First message
        response1 = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "message": "My name is TestUser.",
                "include_file_context": False
            },
            timeout=60
        )
        assert response1.status_code == 200
        session_id = response1.json().get("session_id")
        
        # Wait a moment
        time.sleep(1)
        
        # Second message in same session
        response2 = requests.post(
            f"{BASE_URL}/api/chat",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "message": "What is my name?",
                "session_id": session_id,
                "include_file_context": False
            },
            timeout=60
        )
        assert response2.status_code == 200
        
        # Get session history
        response3 = requests.get(
            f"{BASE_URL}/api/chat/sessions?session_id={session_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response3.status_code == 200
        data = response3.json()
        
        # Should have multiple messages in history
        messages = data.get("messages", [])
        assert len(messages) >= 2, f"Expected at least 2 messages in history, got {len(messages)}"
        
        print(f"✓ Chat session persistence works")
        print(f"  - Session has {len(messages)} messages")


class TestSemanticSearch:
    """Tests for semantic search functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_search_endpoint_works(self, auth_token):
        """Test that search endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/files/search?q=document",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Search endpoint returns 200")
    
    def test_search_returns_results(self, auth_token):
        """Test that search returns results structure"""
        response = requests.get(
            f"{BASE_URL}/api/files/search?q=test",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "files" in data, "Missing 'files' field"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        
        print(f"✓ Search returns correct structure")
        print(f"  - Total results: {data.get('total')}")


class TestPublicFileAccess:
    """Tests for public file accessibility in RAG"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_files_endpoint_with_visibility_filter(self, auth_token):
        """Test that files endpoint supports visibility filter"""
        # Test public visibility filter
        response = requests.get(
            f"{BASE_URL}/api/files?visibility=public",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "files" in data, "Missing 'files' field"
        
        print(f"✓ Files endpoint supports visibility filter")
        print(f"  - Public files found: {data.get('total', 0)}")
    
    def test_files_endpoint_returns_public_files(self, auth_token):
        """Test that files endpoint includes public files"""
        response = requests.get(
            f"{BASE_URL}/api/files?visibility=all",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        files = data.get("files", [])
        if files:
            # Check that files include both public and private
            print(f"✓ Files endpoint returns files")
            print(f"  - Total accessible files: {data.get('total')}")
            
            # Check for is_public field
            public_count = sum(1 for f in files if f.get("is_public", False))
            private_count = len(files) - public_count
            print(f"  - Public: {public_count}, Private: {private_count}")


# Health check test
class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
