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

        # Print final summary
        self.print_summary()
        return self.tests_passed == self.tests_run

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