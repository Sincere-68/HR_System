import json
import os
import sys
from urllib import error, request

BASE = 'http://127.0.0.1:3000/api/v1'
PASSWORD = os.environ.get('EMPLOYMENT_SMOKE_PASSWORD')
if not PASSWORD:
    raise SystemExit('Set EMPLOYMENT_SMOKE_PASSWORD')


def call(method, path, token=None, data=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(data).encode() if data is not None else None
    req = request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=20) as response:
            return response.status, json.load(response)
    except error.HTTPError as exc:
        return exc.code, json.load(exc)


def login(username):
    status, body = call('POST', '/auth/login', data={'username': username, 'password': PASSWORD})
    assert status == 201, (status, body.get('message'))
    return body['accessToken'], body['user']['id']


def assert_status(label, status, expected):
    print(label, status)
    assert status == expected, (label, status, expected)


admin, admin_id = login('MOCK-HR-SMOKE-admin')
department, department_id = login('MOCK-HR-SMOKE-department')
status, probation = call('GET', '/employment/probation?view=expiring', admin)
assert_status('initial probation', status, 200)
rows = [item for item in probation['data'] if item['employeeNo'] == 'MOCK-HR-SMOKE-002']
if not rows:
    status, completed = call('GET', '/employment/probation?view=completed&keyword=MOCK-HR-SMOKE-002', admin)
    assert_status('previous workflow completion', status, 200)
    assert len(completed['data']) == 1 and completed['data'][0]['status'] == 'COMPLETED'
    status, current = call('GET', '/employment/records?view=current&keyword=MOCK-HR-SMOKE-002', admin)
    assert_status('completed current personnel status', status, 200)
    assert current['data'][0]['personnelStatus'] == 'REGULAR'
    status, history = call('GET', '/employment/records?view=history&keyword=MOCK-HR-SMOKE-002', admin)
    assert_status('historical probation status', status, 200)
    assert history['data'][0]['personnelStatus'] == 'PROBATION'
    print('previous fictional workflow verified after restart')
    sys.exit(0)
assert len(rows) == 1, 'Need untouched fictional probation record'
probation_id = rows[0]['id']

status, before = call('GET', '/employment/records?view=current&keyword=MOCK-HR-SMOKE-002', admin)
assert_status('before current employment', status, 200)
assert before['data'][0]['personnelStatus'] == 'PROBATION'
status, started = call('POST', '/employment/probation/' + probation_id + '/evaluation', admin, {'evaluationType': 'REGULARIZATION'})
assert_status('start evaluation', status, 201)
status, repeated = call('POST', '/employment/probation/' + probation_id + '/evaluation', admin, {'evaluationType': 'REGULARIZATION'})
assert_status('reject repeated evaluation', status, 409)
status, submitted = call('POST', '/employment/probation/' + probation_id + '/submit-confirmation', admin, {'evaluation': '模拟试用考核通过', 'approverUserId': admin_id})
assert_status('submit confirmation', status, 201)
status, waiting = call('GET', '/employment/records?view=current&keyword=MOCK-HR-SMOKE-002', admin)
assert_status('still probation while approval pending', status, 200)
assert waiting['data'][0]['personnelStatus'] == 'PROBATION'
status, forbidden = call('POST', '/employment/probation/' + probation_id + '/approval/approve', department)
assert_status('department non-approver cannot approve', status, 403)
status, approved = call('POST', '/employment/probation/' + probation_id + '/approval/approve', admin)
assert_status('approver approves', status, 201)
status, interim = call('GET', '/employment/records?view=current&keyword=MOCK-HR-SMOKE-002', admin)
assert interim['data'][0]['personnelStatus'] == 'PROBATION', 'Approval alone cannot change formal status'
status, confirmed = call('POST', '/employment/probation/' + probation_id + '/confirm', admin, {'confirmedDate': '2026-09-18'})
assert_status('final confirmation', status, 201)
status, repeated_confirm = call('POST', '/employment/probation/' + probation_id + '/confirm', admin, {'confirmedDate': '2026-09-18'})
assert_status('reject duplicate final confirmation', status, 409)
status, after = call('GET', '/employment/records?view=current&keyword=MOCK-HR-SMOKE-002', admin)
assert_status('after current employment', status, 200)
assert after['data'][0]['personnelStatus'] == 'REGULAR', after['data'][0]
status, completed = call('GET', '/employment/probation?view=completed&keyword=MOCK-HR-SMOKE-002', admin)
assert_status('completed probation', status, 200)
assert len(completed['data']) == 1 and completed['data'][0]['status'] == 'COMPLETED'
print('workflow completed', 'probationId', probation_id, 'employee', 'MOCK-HR-SMOKE-002')
sys.exit(0)
