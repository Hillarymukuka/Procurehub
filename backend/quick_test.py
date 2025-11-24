import requests
from datetime import datetime, timedelta

login_response = requests.post('http://127.0.0.1:8000/api/auth/token', 
                               data={'username': 'admin@procurahub.local', 'password': 'admin123'})
headers = {'Authorization': f'Bearer {login_response.json()["access_token"]}'}

files = [('files', ('test.txt', b'Test content', 'text/plain'))]
form = {
    'title': 'Quick Test',
    'description': 'Testing',
    'category': 'Office Supplies',
    'budget': '1000',
    'currency': 'USD',
    'deadline': (datetime.now() + timedelta(days=7)).isoformat()
}

r = requests.post('http://127.0.0.1:8000/api/rfqs/', headers=headers, files=files, data=form)
print(f'Status: {r.status_code}')
print(f'Documents: {len(r.json().get("documents", []))}')
