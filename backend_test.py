#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ArchivaAPITester:
    def __init__(self, base_url="https://gh-rebuild.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.test_user = {
            "email": "test@archiva.com",
            "password": "test123", 
            "name": "Test User"
        }
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
                return True, response.json() if response.text else {}
            else:
                self.failed_tests.append({
                    "name": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.failed_tests.append({
                "name": name,
                "expected": expected_status,
                "actual": "Exception",
                "error": str(e)
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",  # Root of /api
            200
        )
        return success

    def test_register(self):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=self.test_user
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   ✓ Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test user login - only if registration failed (user might already exist)"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": self.test_user["email"],
                "password": self.test_user["password"]
            }
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   ✓ Token obtained via login: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.token:
            print("❌ Skipping auth/me test - no token available")
            return False
        
        success, response = self.run_test(
            "Get Current User",
            "GET", 
            "auth/me",
            200
        )
        return success

    def test_files_list(self):
        """Test listing files (should return empty initially)"""
        success, response = self.run_test(
            "List Files",
            "GET",
            "files",
            200
        )
        return success

    def test_files_stats(self):
        """Test file statistics endpoint"""
        success, response = self.run_test(
            "File Statistics", 
            "GET",
            "files/stats",
            200
        )
        return success

    def test_file_tags(self):
        """Test get all tags endpoint"""
        success, response = self.run_test(
            "Get All Tags",
            "GET",
            "files/tags", 
            200
        )
        return success

    def test_embedding_status(self):
        """Test embedding status endpoint"""
        success, response = self.run_test(
            "Embedding Status",
            "GET",
            "files/embedding-status",
            200
        )
        return success

    def test_projects_list(self):
        """Test listing projects"""
        success, response = self.run_test(
            "List Projects",
            "GET",
            "projects",
            200
        )
        return success

    def test_save_as_project_flow(self):
        """Test the complete 'Save as Project' flow"""
        print("\n📁 Testing Save as Project Flow...")
        
        # Step 1: Upload a test file about machine learning
        print("  Step 1: Uploading test file about machine learning...")
        test_content = """Machine Learning in Modern Applications

Machine learning is transforming various industries through intelligent automation and data analysis:

1. Natural Language Processing
- Text classification and sentiment analysis
- Language translation and chatbots
- Document summarization and information extraction

2. Computer Vision
- Image recognition and object detection
- Medical imaging analysis
- Autonomous vehicle navigation

3. Predictive Analytics
- Financial market prediction
- Customer behavior analysis
- Supply chain optimization

4. Recommendation Systems
- E-commerce product recommendations
- Content recommendation for streaming platforms
- Personalized advertising

These technologies are revolutionizing how we interact with data and make decisions.
"""
        
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(test_content)
            temp_file_path = f.name
        
        try:
            url = f"{self.base_url}/files/upload"
            headers = {}
            if self.token:
                headers['Authorization'] = f'Bearer {self.token}'
            
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('machine_learning_test.txt', f, 'text/plain')}
                data = {'tags': 'machine learning,ai,technology'}
                
                self.tests_run += 1
                response = requests.post(url, files=files, data=data, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    self.tests_passed += 1
                    upload_result = response.json()
                    file_id = upload_result.get('id')
                    print(f"    ✅ File uploaded - ID: {file_id}")
                else:
                    self.failed_tests.append({
                        "name": "Upload ML File",
                        "expected": 200,
                        "actual": response.status_code,
                        "error": response.text
                    })
                    print(f"    ❌ File upload failed: {response.status_code}")
                    return False
                    
        except Exception as e:
            self.failed_tests.append({
                "name": "Upload ML File",
                "expected": 200,
                "actual": "Exception", 
                "error": str(e)
            })
            print(f"    ❌ Upload error: {str(e)}")
            return False
        finally:
            try:
                os.unlink(temp_file_path)
            except:
                pass

        # Step 2: Wait for embeddings and search for 'machine learning'
        print("  Step 2: Waiting for embeddings and searching for 'machine learning'...")
        import time
        time.sleep(3)  # Wait for embeddings to process
        
        search_success, search_response = self.run_test(
            "Search ML Content",
            "GET",
            "files/search?q=machine+learning",
            200
        )
        
        if not search_success:
            print("    ❌ Search failed")
            return False
        
        files = search_response.get('files', [])
        if not files:
            print("    ❌ No files found in search")
            return False
        
        file_ids = [f['id'] for f in files[:2]]  # Take first 2 files
        print(f"    ✅ Found {len(files)} files, using IDs: {file_ids}")

        # Step 3: Summarize the files
        print("  Step 3: Summarizing the selected files...")
        
        # Test with longer timeout for AI summarization
        print("    (Note: AI summarization may take 10-30 seconds...)")
        url = f"{self.base_url}/files/summarize"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        try:
            response = requests.post(url, json={
                "file_ids": file_ids,
                "query": "machine learning"
            }, headers=test_headers, timeout=45)  # 45 second timeout

            if response.status_code == 200:
                self.tests_passed += 1
                summarize_response = response.json()
                summarize_success = True
                print(f"    ✅ Summarization successful")
            else:
                self.failed_tests.append({
                    "name": "Summarize ML Files",
                    "expected": 200,
                    "actual": response.status_code,
                    "error": response.text
                })
                print(f"    ❌ Summarization failed: {response.status_code}")
                return False
        except Exception as e:
            self.failed_tests.append({
                "name": "Summarize ML Files",
                "expected": 200,
                "actual": "Exception",
                "error": str(e)
            })
            print(f"    ❌ Summarization error: {str(e)}")
            return False
        if not summarize_success:
            print("    ❌ Summarization failed")
            return False
            
        article = summarize_response
        print(f"    ✅ Summary generated - Title: '{article.get('title', 'N/A')}'")

        # Step 4: Create a project with the summary and file_ids  
        print("  Step 4: Creating project with summary and file IDs...")
        
        project_data = {
            "name": "Machine Learning Research Project",
            "description": f"Summary: {article.get('content', '')[:500]}...",
            "file_ids": file_ids
        }
        
        create_success, create_response = self.run_test(
            "Create Project",
            "POST", 
            "projects",
            200,
            data=project_data
        )
        
        if not create_success:
            print("    ❌ Project creation failed")
            return False
            
        project_id = create_response.get('id')
        print(f"    ✅ Project created - ID: {project_id}")

        # Step 5: Verify project was created correctly
        print("  Step 5: Verifying project creation...")
        
        get_success, get_response = self.run_test(
            "Get Created Project",
            "GET",
            f"projects/{project_id}",
            200
        )
        
        if not get_success:
            print("    ❌ Project retrieval failed")
            return False
            
        project = get_response
        project_file_ids = project.get('file_ids', [])
        
        # Verify the project contains the correct file_ids
        if set(project_file_ids) == set(file_ids):
            print(f"    ✅ Project contains correct files: {project_file_ids}")
        else:
            print(f"    ❌ Project file IDs mismatch. Expected: {file_ids}, Got: {project_file_ids}")
            return False

        # Step 6: Verify project appears in projects list
        print("  Step 6: Verifying project appears in list...")
        
        list_success, list_response = self.run_test(
            "List Projects (Verify)",
            "GET",
            "projects", 
            200
        )
        
        if not list_success:
            print("    ❌ Projects list failed")
            return False
            
        projects = list_response if isinstance(list_response, list) else []
        project_found = any(p.get('id') == project_id for p in projects)
        
        if project_found:
            print(f"    ✅ Project found in list")
            return True
        else:
            print(f"    ❌ Project not found in list")
            return False

    def test_file_upload(self):
        """Test file upload with AI tagging"""
        print("\n🔍 Testing File Upload with AI Tagging...")
        url = f"{self.base_url}/files/upload"
        
        # Create test content about AI in healthcare
        test_content = """AI Applications in Healthcare

        Artificial Intelligence is revolutionizing healthcare through various applications:

        1. Medical Imaging and Diagnostics
        - Cancer detection in radiology scans
        - Automated analysis of X-rays, CT scans, and MRIs
        - Early detection of diseases like diabetic retinopathy

        2. Drug Discovery and Development
        - Accelerating the identification of new drug compounds
        - Predicting drug interactions and side effects
        - Optimizing clinical trial design

        3. Personalized Medicine
        - Tailoring treatments based on genetic profiles
        - Precision dosing of medications
        - Predictive analytics for patient outcomes

        4. Virtual Health Assistants
        - AI-powered chatbots for patient support
        - Symptom checkers and triage systems
        - Medication reminders and adherence monitoring

        These applications are transforming patient care and medical research.
        """
        
        # Create a temporary file
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(test_content)
            temp_file_path = f.name
        
        try:
            headers = {}
            if self.token:
                headers['Authorization'] = f'Bearer {self.token}'
            
            # Upload file
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test_document.txt', f, 'text/plain')}
                data = {'tags': 'healthcare,ai,medical'}
                
                self.tests_run += 1
                response = requests.post(url, files=files, data=data, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    self.tests_passed += 1
                    result = response.json()
                    print(f"✅ File upload successful - File ID: {result.get('id', 'N/A')}")
                    print(f"   AI Tags generated: {result.get('ai_tags', [])}")
                    print(f"   All tags: {result.get('tags', [])}")
                    print(f"   File size: {result.get('file_size', 0)} bytes")
                    return True, result
                else:
                    self.failed_tests.append({
                        "name": "File Upload",
                        "expected": 200,
                        "actual": response.status_code,
                        "error": response.text
                    })
                    print(f"❌ File upload failed - Status: {response.status_code}")
                    print(f"   Error: {response.text[:200]}")
                    return False, {}
                    
        except Exception as e:
            self.failed_tests.append({
                "name": "File Upload", 
                "expected": 200,
                "actual": "Exception",
                "error": str(e)
            })
            print(f"❌ File upload error: {str(e)}")
            return False, {}
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass

    def test_embedding_status_enabled(self):
        """Test that embedding status shows enabled and rag_ready is true"""
        success, response = self.run_test(
            "Embedding Status (RAG Ready Check)",
            "GET",
            "files/embedding-status",
            200
        )
        if success:
            status = response.get('status')
            rag_ready = response.get('rag_ready', False)
            print(f"   Embedding Status: {status}")
            print(f"   RAG Ready: {rag_ready}")
            print(f"   Total Files: {response.get('total_files', 0)}")
            print(f"   Files with Embeddings: {response.get('files_with_embeddings', 0)}")
            print(f"   Total Embeddings: {response.get('total_embeddings', 0)}")
            
            if status == 'enabled' and rag_ready:
                print(f"✅ RAG system is ready!")
                return True
            else:
                print(f"⚠️  RAG system not ready - Status: {status}, RAG Ready: {rag_ready}")
                return False
        return False

    def test_semantic_search(self):
        """Test semantic search functionality"""
        success, response = self.run_test(
            "Semantic Search - Healthcare Query",
            "GET",
            "files/search?q=healthcare&smart=true",
            200
        )
        if success:
            files = response.get('files', [])
            search_type = response.get('search_type', 'unknown')
            semantic_enabled = response.get('semantic_enabled', False)
            
            print(f"   Search Type: {search_type}")
            print(f"   Semantic Enabled: {semantic_enabled}")
            print(f"   Results Found: {len(files)}")
            
            if files:
                for file in files[:2]:  # Show first 2 results
                    search_info = file.get('_search_info', {})
                    print(f"   - {file.get('original_filename', 'Unknown')}")
                    print(f"     Match Types: {search_info.get('match_types', [])}")
                    print(f"     Score: {search_info.get('score', 'N/A')}")
            
            return len(files) > 0
        return False

    def test_ai_chat_rag(self):
        """Test AI chat with RAG context"""
        success, response = self.run_test(
            "AI Chat RAG Query",
            "POST", 
            "chat",
            200,
            data={
                "message": "What applications of AI are in my documents?",
                "include_file_context": True
            }
        )
        if success:
            ai_response = response.get('response', '')
            sources = response.get('sources', [])
            session_id = response.get('session_id', '')
            
            print(f"   AI Response Length: {len(ai_response)} characters")
            print(f"   Sources Found: {len(sources)}")
            print(f"   Session ID: {session_id[:20]}..." if session_id else "N/A")
            
            if sources:
                print(f"   Source Files:")
                for source in sources[:3]:  # Show first 3 sources
                    print(f"   - {source.get('filename', 'Unknown')} (relevance: {source.get('relevance', 'N/A')})")
            
            # Check if response mentions healthcare/medical content
            healthcare_terms = ['healthcare', 'medical', 'cancer', 'diagnostic', 'patient', 'clinical']
            found_terms = [term for term in healthcare_terms if term.lower() in ai_response.lower()]
            
            print(f"   Healthcare terms found: {found_terms}")
            
            return len(ai_response) > 50 and len(sources) > 0
        return False

    def run_rag_pipeline_test(self):
        """Run comprehensive RAG pipeline test"""
        print("=" * 70)
        print("🧠 Starting RAG Pipeline Comprehensive Test")
        print(f"Base URL: {self.base_url}")
        print("=" * 70)

        # Step 1: Ensure we're authenticated
        if not self.token:
            print("🔄 Authenticating first...")
            login_success = self.test_login()
            if not login_success:
                print("❌ Authentication failed. Cannot test RAG pipeline.")
                return False

        # Step 2: Test file upload with AI tagging
        print("\n📤 Step 1: Testing File Upload with AI Tagging...")
        upload_success, upload_result = self.test_file_upload()
        
        # Step 3: Check embedding status 
        print("\n🧠 Step 2: Checking Embedding Status...")
        import time
        time.sleep(2)  # Give time for embeddings to process
        embedding_ready = self.test_embedding_status_enabled()
        
        # Step 4: Test semantic search
        print("\n🔍 Step 3: Testing Semantic Search...")
        time.sleep(1)  # Brief pause
        search_success = self.test_semantic_search()
        
        # Step 5: Test AI chat with RAG
        print("\n💬 Step 4: Testing AI Chat with RAG...")
        time.sleep(1)  # Brief pause
        chat_success = self.test_ai_chat_rag()
        
        # Summary
        print("\n" + "=" * 70)
        print("🧠 RAG PIPELINE TEST RESULTS")
        print("=" * 70)
        steps = [
            ("File Upload with AI Tagging", upload_success),
            ("Embedding Status (RAG Ready)", embedding_ready), 
            ("Semantic Search", search_success),
            ("AI Chat with RAG", chat_success)
        ]
        
        for step_name, success in steps:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{step_name}: {status}")
        
        passed_steps = sum(1 for _, success in steps if success)
        print(f"\nRAG Pipeline Success Rate: {passed_steps}/{len(steps)} ({passed_steps/len(steps)*100:.1f}%)")
        
        return passed_steps == len(steps)

    def run_comprehensive_test(self):
        """Run all API tests in sequence"""
        print("=" * 60)
        print("🚀 Starting Archiva API Comprehensive Test")
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {self.test_user['email']}")
        print("=" * 60)

        # Test API root
        self.test_root_endpoint()

        # Test authentication flow
        register_success = self.test_register()
        if not register_success:
            print("🔄 Registration failed, trying login (user may already exist)...")
            login_success = self.test_login()
            if not login_success:
                print("❌ Both registration and login failed. Cannot continue with authenticated tests.")
                self.print_summary()
                return False

        # Test authenticated endpoints
        self.test_auth_me()
        self.test_files_list()
        self.test_files_stats()
        self.test_file_tags()
        self.test_embedding_status()
        self.test_projects_list()

        # Test the new 'Save as Project' functionality
        print("\n📁 Testing new 'Save as Project' feature...")
        save_project_success = self.test_save_as_project_flow()

        # Print final summary
        self.print_summary()
        
        # Run RAG pipeline test separately
        print("\n" + "🧠" * 20)
        rag_success = self.run_rag_pipeline_test()
        
        return (self.tests_passed == self.tests_run) and rag_success and save_project_success

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"{i}. {failure['name']}")
                print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                print(f"   Error: {failure['error'][:100]}...")
        
        print("\n✅ Backend API Status:", "HEALTHY" if self.tests_passed >= 7 else "ISSUES FOUND")

def main():
    """Main test execution"""
    tester = ArchivaAPITester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())