import json
import os
from urllib import error, request

BASE = 'http://127.0.0.1:3000/api/v1'
PASSWORD = os.environ.get('EMPLOYMENT_SMOKE_PASSWORD')
if not PASSWORD:
    raise SystemExit('Set EMPLOYMENT_SMOKE_PASSWORD')


def call(method, path, token=None, data=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=20) as response:
            return response.status, json.load(response)
    except error.HTTPError as exc:
        return exc.code, json.load(exc)


def login(username):
    status, response = call('POST', '/auth/login', data={'username': username, 'password': PASSWORD})
    assert status == 201, (username, status)
    return response['accessToken']


admin = login('MOCK-HR-SMOKE-admin')
department = login('MOCK-HR-SMOKE-department')
needle = 'MOCK-HR-SMOKE-004'


def search(token, view):
    status, body = call('GET', '/employment/records?view=' + view + '&keyword=' + needle, token)
    assert status == 200, (status, body.get('message'))
    return body['data']


admin_current = search(admin, 'current')
admin_history = search(admin, 'history')
department_current = search(department, 'current')
department_history = search(department, 'history')
assert len(admin_current) == 1 and admin_current[0]['departmentName'] == '云岭数科模拟交付部'
assert len(admin_history) == 2
assert department_current == []
assert len(department_history) == 1 and department_history[0]['departmentName'] == '云岭数科模拟产品部'
assert department_history[0]['canViewEmployeeDetail'] is False
assignment_id = department_history[0]['id']
status, details = call('GET', '/employment/records/' + assignment_id, department)
assert status == 200, (status, details.get('message'))
assert details['organization']['name'] == '云岭数科模拟产品部'
assert details['canViewEmployeeDetail'] is False
status, denied = call('GET', '/employees/' + department_history[0]['employeeId'], department)
assert status in (403, 404), (status, denied.get('message'))
current_detail_denied = True
status, graph = call('GET', '/employment/reporting-relationships?view=graph', department)
assert status == 200
assert needle not in json.dumps(graph, ensure_ascii=False), 'Current B employee leaked into A reporting graph'
print('scope checks passed', {
    'adminCurrent': len(admin_current),
    'adminHistory': len(admin_history),
    'departmentCurrent': len(department_current),
    'departmentHistory': len(department_history),
    'historicalDetailStatus': 200,
    'currentDetailDenied': current_detail_denied,
})
