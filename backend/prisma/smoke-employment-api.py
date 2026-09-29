import json
import os
import sys
from urllib import error, request

BASE = 'http://127.0.0.1:3000/api/v1'
PASSWORD = os.environ.get('EMPLOYMENT_SMOKE_PASSWORD')
if not PASSWORD:
    raise SystemExit('Set EMPLOYMENT_SMOKE_PASSWORD for the isolated HR smoke accounts')


def get_token(username):
    body = json.dumps({'username': username, 'password': PASSWORD}).encode()
    req = request.Request(BASE + '/auth/login', data=body, headers={'Content-Type': 'application/json'})
    with request.urlopen(req, timeout=10) as response:
        return json.load(response)['accessToken']


def get(path, token):
    req = request.Request(BASE + path, headers={'Authorization': 'Bearer ' + token})
    try:
        with request.urlopen(req, timeout=20) as response:
            return response.status, json.load(response)
    except error.HTTPError as exc:
        return exc.code, json.load(exc)


admin = get_token('MOCK-HR-SMOKE-admin')
department = get_token('MOCK-HR-SMOKE-department')
checks = [
    ('admin current', admin, '/employment/records?view=current'),
    ('admin history', admin, '/employment/records?view=history'),
    ('department current', department, '/employment/records?view=current'),
    ('department history', department, '/employment/records?view=history'),
    ('probation', admin, '/employment/probation?view=all'),
    ('probation counts', department, '/employment/view-counts'),
    ('report graph', admin, '/employment/reporting-relationships?view=graph'),
    ('report graph scoped', department, '/employment/reporting-relationships?view=graph'),
    ('movement', admin, '/employment/movements'),
    ('trial', admin, '/employment/trial-posts'),
    ('interns', admin, '/employment/interns'),
    ('labor', admin, '/employment/labor-workers'),
    ('termination', admin, '/employment/terminations'),
    ('retirement', admin, '/employment/retirements'),
    ('part-time', admin, '/employment/part-time'),
]
failed = 0
for title, token, path in checks:
    status, body = get(path, token)
    if status != 200:
        failed += 1
        print(title, status, body.get('message'))
        continue
    if isinstance(body, dict) and 'data' in body:
        print(title, status, 'rows', len(body['data']), 'total', body['meta']['total'])
    elif isinstance(body, dict) and 'items' in body:
        print(title, status, 'supported', sum(item['supported'] for item in body['items']))
    else:
        print(title, status, 'keys', list(body))

print('failed', failed, 'of', len(checks))
sys.exit(1 if failed else 0)
