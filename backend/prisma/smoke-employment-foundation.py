import json
import os
import sys
from datetime import date, timedelta
from urllib import error, parse, request

BASE = os.environ.get('EMPLOYMENT_STAGE2_BASE_URL', 'http://127.0.0.1:3102/api/v1')
PASSWORD = os.environ.get('EMPLOYMENT_STAGE2_PASSWORD')
PREFIX = 'MOCK-HR-STAGE2-'
if not PASSWORD:
    raise SystemExit('Set EMPLOYMENT_STAGE2_PASSWORD')


def call(method, path, token=None, data=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(data, ensure_ascii=False).encode('utf-8') if data is not None else None
    req = request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = {'raw': raw.decode('utf-8', errors='replace')}
        return exc.code, payload


def expect(label, status, expected, body=None):
    print(f'{label}: {status}')
    assert status == expected, (label, status, expected, body)
    return body


def login(suffix):
    username = PREFIX + suffix
    status, body = call('POST', '/auth/login', data={'username': username, 'password': PASSWORD})
    expect('login ' + suffix, status, 201, body)
    return body['accessToken'], body['user']


def lookup_employee(token, employee_no):
    status, body = call('GET', '/employees?keyword=' + parse.quote(employee_no), token)
    expect('lookup ' + employee_no, status, 200, body)
    rows = [row for row in body['data'] if row['employeeNo'] == employee_no]
    assert len(rows) == 1, (employee_no, rows)
    return rows[0]


def create_flow(token, business_type, code_suffix, name, approver_one_id, approver_two_id):
    status, body = call('POST', '/employment-approval-flows', token, {
        'businessType': business_type,
        'code': PREFIX + code_suffix,
        'name': name,
        'nodes': [
            {'stepOrder': 1, 'assigneeKind': 'USER', 'assigneeUserId': approver_one_id},
            {'stepOrder': 2, 'assigneeKind': 'USER', 'assigneeUserId': approver_two_id},
        ],
    })
    expect('create flow ' + business_type, status, 201, body)
    version = body['versions'][0]
    status, published = call('POST', '/employment-approval-flows/versions/' + version['id'] + '/publish', token)
    expect('publish flow ' + business_type, status, 201, published)
    assert published['status'] == 'PUBLISHED'
    assert published['versions'][0]['status'] == 'PUBLISHED'
    return published


def source_period_id(employee_no):
    fixture_key = employee_no.removeprefix(PREFIX).lower()
    return 'stage2-period-' + fixture_key


def create_conversion(token, employee, conversion_type, planned_date):
    status, body = call('POST', '/employment/conversions', token, {
        'type': conversion_type,
        'employeeId': employee['id'],
        'sourceEmploymentPeriodId': source_period_id(employee['employeeNo']),
        'targetOrganizationId': 'stage2-organization-b',
        'targetPositionId': 'stage2-position-b',
        'targetJobTitleId': 'stage2-job-title-b',
        'targetJobLevel': 'S3',
        'plannedEffectiveDate': planned_date,
    })
    expect('create conversion ' + employee['employeeNo'], status, 201, body)
    assert body['status'] == 'PENDING'
    assert body['approvalRequestId']
    return body


def create_part_time(token, employee, label, start_date, manager_id):
    status, body = call('POST', '/employment/part-time-records', token, {
        'employeeId': employee['id'],
        'type': label,
        'institution': PREFIX + label,
        'organizationId': 'stage2-organization-a',
        'jobTitleId': 'stage2-job-title-a',
        'managerEmployeeId': manager_id,
        'startDate': start_date,
    })
    expect('create part-time ' + employee['employeeNo'], status, 201, body)
    assert body['status'] == 'PENDING'
    assert body['approvalRequestId']
    return body


def get_approval(token, approval_id, label='get approval'):
    status, body = call('GET', '/employment-approvals/' + approval_id, token)
    expect(label, status, 200, body)
    return body


def approve(token, approval_id, comment, label):
    status, body = call('POST', '/employment-approvals/' + approval_id + '/approve', token, {'comment': comment})
    expect(label, status, 201, body)
    return body


def expect_business_status(token, path, expected_status, label):
    status, body = call('GET', path, token)
    expect(label, status, 200, body)
    assert body['status'] == expected_status, (label, body)
    return body


applicant_token, applicant_user = login('applicant')
approver_one_token, approver_one_user = login('approver-one')
approver_two_token, approver_two_user = login('approver-two')
outsider_token, outsider_user = login('outsider')
viewer_token, viewer_user = login('viewer')
assert applicant_user['id'] == 'stage2-user-applicant'
assert approver_one_user['id'] == 'stage2-user-approver-one'
assert approver_two_user['id'] == 'stage2-user-approver-two'

status, denied_flow = call('POST', '/employment-approval-flows', approver_one_token, {
    'businessType': 'INTERN_TO_EMPLOYEE',
    'code': PREFIX + 'DENIED-FLOW',
    'name': '不应创建的虚构流程',
    'nodes': [{'stepOrder': 1, 'assigneeKind': 'USER', 'assigneeUserId': approver_one_user['id']}],
})
expect('deny flow management without permission', status, 403, denied_flow)

status, viewer_denied = call('GET', '/employment/part-time-records', viewer_token)
expect('viewer has no business permission', status, 403, viewer_denied)

employee_nos = {
    'conversion_happy': PREFIX + 'CONVERSION-HAPPY',
    'conversion_rollback': PREFIX + 'CONVERSION-ROLLBACK',
    'conversion_withdraw': PREFIX + 'CONVERSION-WITHDRAW',
    'conversion_return': PREFIX + 'CONVERSION-RETURN',
    'conversion_reject': PREFIX + 'CONVERSION-REJECT',
    'part_time_happy': PREFIX + 'PART-TIME-HAPPY',
    'part_time_future': PREFIX + 'PART-TIME-FUTURE',
    'part_time_reject': PREFIX + 'PART-TIME-REJECT',
    'part_time_withdraw': PREFIX + 'PART-TIME-WITHDRAW',
    'part_time_return': PREFIX + 'PART-TIME-RETURN',
    'manager': PREFIX + 'MANAGER',
}
employees = {key: lookup_employee(applicant_token, employee_no) for key, employee_no in employee_nos.items()}
manager_id = employees['manager']['id']

today = date.today()
effective_date = today.isoformat()
future_start_date = (today + timedelta(days=2)).isoformat()

# No published flow: conversion creation must roll back completely.
status, missing_flow_conversion = call('POST', '/employment/conversions', applicant_token, {
    'type': 'INTERN_TO_EMPLOYEE',
    'employeeId': employees['conversion_happy']['id'],
    'sourceEmploymentPeriodId': source_period_id(employees['conversion_happy']['employeeNo']),
    'targetOrganizationId': 'stage2-organization-b',
    'targetPositionId': 'stage2-position-b',
    'targetJobTitleId': 'stage2-job-title-b',
    'targetJobLevel': 'S3',
    'plannedEffectiveDate': effective_date,
})
expect('conversion rolls back without published flow', status, 422, missing_flow_conversion)

status, missing_flow_part_time = call('POST', '/employment/part-time-records', applicant_token, {
    'employeeId': employees['part_time_happy']['id'],
    'type': '无流程回滚验证',
    'institution': PREFIX + 'NO-FLOW',
    'organizationId': 'stage2-organization-a',
    'jobTitleId': 'stage2-job-title-a',
    'startDate': today.isoformat(),
})
expect('part-time rolls back without published flow', status, 422, missing_flow_part_time)

create_flow(
    applicant_token,
    'INTERN_TO_EMPLOYEE',
    'FLOW-INTERN',
    'Stage 2 虚构实习转正式流程',
    approver_one_user['id'],
    approver_two_user['id'],
)
create_flow(
    applicant_token,
    'LABOR_TO_EMPLOYEE',
    'FLOW-LABOR',
    'Stage 2 虚构劳务转正式流程',
    approver_one_user['id'],
    approver_two_user['id'],
)
create_flow(
    applicant_token,
    'PART_TIME_RECORD',
    'FLOW-PART-TIME',
    'Stage 2 虚构兼职流程',
    approver_one_user['id'],
    approver_two_user['id'],
)

# Conversion happy path with two serial approvals.
conversion = create_conversion(applicant_token, employees['conversion_happy'], 'INTERN_TO_EMPLOYEE', effective_date)
approval_id = conversion['approvalRequestId']
status, scoped_detail = call('GET', '/employment-approvals/' + approval_id, approver_one_token)
expect('in-scope department HR can view approval', status, 200, scoped_detail)
status, outsider_detail = call('GET', '/employment-approvals/' + approval_id, outsider_token)
expect('out-of-scope non-participant cannot view approval', status, 403, outsider_detail)
status, wrong_approver = call('POST', '/employment-approvals/' + approval_id + '/approve', outsider_token, {'comment': '不应通过'})
expect('non-current approver cannot approve', status, 403, wrong_approver)
status, wrong_order = call('POST', '/employment-approvals/' + approval_id + '/approve', approver_two_token, {'comment': '不能越级'})
expect('second approver cannot approve first step', status, 403, wrong_order)
status, current_one = call('GET', '/employment-approvals/current?page=1&pageSize=100', approver_one_token)
expect('first approver current queue', status, 200, current_one)
assert any(row['id'] == approval_id for row in current_one['data'])
first = approve(approver_one_token, approval_id, 'Stage 2 一级通过', 'approve conversion step one')
assert first['status'] == 'PENDING' and first['employmentStatus'] == 'PENDING' and first['currentStep'] == 2
expect_business_status(
    applicant_token,
    '/employment/conversions/' + conversion['id'],
    'PENDING',
    'conversion remains pending after intermediate approval',
)
status, repeat_first = call('POST', '/employment-approvals/' + approval_id + '/approve', approver_one_token, {'comment': '重复'})
expect('repeat first approval rejected', status, 403, repeat_first)
second = approve(approver_two_token, approval_id, 'Stage 2 二级通过', 'approve conversion final step')
assert second['status'] == 'APPROVED' and second['employmentStatus'] == 'PENDING_EFFECTIVE'
expect_business_status(
    applicant_token,
    '/employment/conversions/' + conversion['id'],
    'PENDING_EFFECTIVE',
    'conversion synchronized to pending-effective',
)
status, activated = call('POST', '/employment/conversions/' + conversion['id'] + '/activate', applicant_token)
expect('activate conversion', status, 201, activated)
assert activated['status'] == 'COMPLETED'
completed_approval = get_approval(applicant_token, approval_id, 'conversion approval completed')
assert completed_approval['status'] == 'COMPLETED'
assert completed_approval['employmentStatus'] == 'COMPLETED'
status, repeated_activation = call('POST', '/employment/conversions/' + conversion['id'] + '/activate', applicant_token)
expect('duplicate conversion activation rejected', status, 409, repeated_activation)

# Missing source employment record: every activation write must roll back.
rollback_conversion = create_conversion(
    applicant_token,
    employees['conversion_rollback'],
    'INTERN_TO_EMPLOYEE',
    effective_date,
)
approve(approver_one_token, rollback_conversion['approvalRequestId'], '回滚验证一级通过', 'approve rollback step one')
approve(approver_two_token, rollback_conversion['approvalRequestId'], '回滚验证二级通过', 'approve rollback final step')
status, rollback_activation = call(
    'POST',
    '/employment/conversions/' + rollback_conversion['id'] + '/activate',
    applicant_token,
)
expect('conversion activation failure rolls back transaction', status, 409, rollback_activation)
expect_business_status(
    applicant_token,
    '/employment/conversions/' + rollback_conversion['id'],
    'PENDING_EFFECTIVE',
    'failed conversion remains pending-effective',
)
rollback_approval = get_approval(applicant_token, rollback_conversion['approvalRequestId'], 'failed conversion approval unchanged')
assert rollback_approval['status'] == 'APPROVED'
assert rollback_approval['employmentStatus'] == 'PENDING_EFFECTIVE'

# Conversion withdraw, return, and reject synchronize business status.
withdraw_conversion = create_conversion(
    applicant_token,
    employees['conversion_withdraw'],
    'INTERN_TO_EMPLOYEE',
    effective_date,
)
status, withdrawn = call(
    'POST',
    '/employment-approvals/' + withdraw_conversion['approvalRequestId'] + '/withdraw',
    applicant_token,
)
expect('withdraw conversion', status, 201, withdrawn)
assert withdrawn['employmentStatus'] == 'WITHDRAWN'
expect_business_status(
    applicant_token,
    '/employment/conversions/' + withdraw_conversion['id'],
    'WITHDRAWN',
    'conversion synchronized to withdrawn',
)

return_conversion = create_conversion(
    applicant_token,
    employees['conversion_return'],
    'INTERN_TO_EMPLOYEE',
    effective_date,
)
status, returned = call(
    'POST',
    '/employment-approvals/' + return_conversion['approvalRequestId'] + '/return',
    approver_one_token,
    {'comment': '请补充虚构材料'},
)
expect('return conversion for revision', status, 201, returned)
assert returned['employmentStatus'] == 'DRAFT'
expect_business_status(
    applicant_token,
    '/employment/conversions/' + return_conversion['id'],
    'DRAFT',
    'conversion synchronized to draft',
)

reject_conversion = create_conversion(
    applicant_token,
    employees['conversion_reject'],
    'LABOR_TO_EMPLOYEE',
    effective_date,
)
status, rejected = call(
    'POST',
    '/employment-approvals/' + reject_conversion['approvalRequestId'] + '/reject',
    approver_one_token,
    {'comment': '虚构条件不符合'},
)
expect('reject labor conversion', status, 201, rejected)
assert rejected['employmentStatus'] == 'REJECTED'
expect_business_status(
    applicant_token,
    '/employment/conversions/' + reject_conversion['id'],
    'REJECTED',
    'labor conversion synchronized to rejected',
)

# Part-time happy path, activation idempotency, and end idempotency.
part_time = create_part_time(
    applicant_token,
    employees['part_time_happy'],
    '项目顾问',
    today.isoformat(),
    manager_id,
)
approve(approver_one_token, part_time['approvalRequestId'], '兼职一级通过', 'approve part-time step one')
expect_business_status(
    applicant_token,
    '/employment/part-time-records/' + part_time['id'],
    'PENDING',
    'part-time remains pending after intermediate approval',
)
approve(approver_two_token, part_time['approvalRequestId'], '兼职二级通过', 'approve part-time final step')
expect_business_status(
    applicant_token,
    '/employment/part-time-records/' + part_time['id'],
    'PENDING_EFFECTIVE',
    'part-time synchronized to pending-effective',
)
status, part_time_active = call('POST', '/employment/part-time-records/' + part_time['id'] + '/activate', applicant_token)
expect('activate part-time', status, 201, part_time_active)
assert part_time_active['status'] == 'ACTIVE'
status, repeat_part_time_activation = call(
    'POST',
    '/employment/part-time-records/' + part_time['id'] + '/activate',
    applicant_token,
)
expect('repeat part-time activation is idempotent', status, 201, repeat_part_time_activation)
assert repeat_part_time_activation['status'] == 'ACTIVE'
status, ended = call(
    'POST',
    '/employment/part-time-records/' + part_time['id'] + '/end',
    applicant_token,
    {'endDate': today.isoformat()},
)
expect('end part-time', status, 201, ended)
assert ended['status'] == 'ENDED'
status, repeat_end = call(
    'POST',
    '/employment/part-time-records/' + part_time['id'] + '/end',
    applicant_token,
    {'endDate': today.isoformat()},
)
expect('repeat part-time end is idempotent', status, 201, repeat_end)
assert repeat_end['status'] == 'ENDED'

# Future-start record remains pending-effective until its date.
future_part_time = create_part_time(
    applicant_token,
    employees['part_time_future'],
    '未来顾问',
    future_start_date,
    manager_id,
)
approve(approver_one_token, future_part_time['approvalRequestId'], '未来兼职一级通过', 'approve future part-time step one')
approve(approver_two_token, future_part_time['approvalRequestId'], '未来兼职二级通过', 'approve future part-time final step')
status, future_activation = call(
    'POST',
    '/employment/part-time-records/' + future_part_time['id'] + '/activate',
    applicant_token,
)
expect('future part-time cannot activate early', status, 409, future_activation)
expect_business_status(
    applicant_token,
    '/employment/part-time-records/' + future_part_time['id'],
    'PENDING_EFFECTIVE',
    'future part-time remains pending-effective',
)
future_approval = get_approval(applicant_token, future_part_time['approvalRequestId'], 'future part-time approval unchanged')
assert future_approval['status'] == 'APPROVED'
assert future_approval['employmentStatus'] == 'PENDING_EFFECTIVE'

# Part-time terminal status synchronization.
reject_part_time = create_part_time(
    applicant_token,
    employees['part_time_reject'],
    '驳回顾问',
    today.isoformat(),
    manager_id,
)
status, rejected_part_time = call(
    'POST',
    '/employment-approvals/' + reject_part_time['approvalRequestId'] + '/reject',
    approver_one_token,
    {'comment': '兼职条件不符合'},
)
expect('reject part-time', status, 201, rejected_part_time)
expect_business_status(
    applicant_token,
    '/employment/part-time-records/' + reject_part_time['id'],
    'REJECTED',
    'part-time synchronized to rejected',
)

withdraw_part_time = create_part_time(
    applicant_token,
    employees['part_time_withdraw'],
    '撤回顾问',
    today.isoformat(),
    manager_id,
)
status, withdrawn_part_time = call(
    'POST',
    '/employment-approvals/' + withdraw_part_time['approvalRequestId'] + '/withdraw',
    applicant_token,
)
expect('withdraw part-time', status, 201, withdrawn_part_time)
expect_business_status(
    applicant_token,
    '/employment/part-time-records/' + withdraw_part_time['id'],
    'WITHDRAWN',
    'part-time synchronized to withdrawn',
)

return_part_time = create_part_time(
    applicant_token,
    employees['part_time_return'],
    '退回顾问',
    today.isoformat(),
    manager_id,
)
status, returned_part_time = call(
    'POST',
    '/employment-approvals/' + return_part_time['approvalRequestId'] + '/return',
    approver_one_token,
    {'comment': '请补充兼职说明'},
)
expect('return part-time for revision', status, 201, returned_part_time)
expect_business_status(
    applicant_token,
    '/employment/part-time-records/' + return_part_time['id'],
    'DRAFT',
    'part-time synchronized to draft',
)

status, part_time_list = call('GET', '/employment/part-time-records?page=1&pageSize=100', applicant_token)
expect('list Stage 2 part-time records', status, 200, part_time_list)
stage2_rows = [
    row for row in part_time_list['data']
    if row['employee']['employeeNo'].startswith(PREFIX)
]
assert len(stage2_rows) == 5, stage2_rows

status, outsider_record = call(
    'GET',
    '/employment/part-time-records/' + future_part_time['id'],
    outsider_token,
)
expect('out-of-scope user cannot read part-time record', status, 404, outsider_record)

status, mine = call('GET', '/employment-approvals/my?page=1&pageSize=100', applicant_token)
expect('applicant approval history', status, 200, mine)
stage2_mine = [row for row in mine['data'] if row.get('businessId') in {
    conversion['id'],
    rollback_conversion['id'],
    withdraw_conversion['id'],
    return_conversion['id'],
    reject_conversion['id'],
    part_time['id'],
    future_part_time['id'],
    reject_part_time['id'],
    withdraw_part_time['id'],
    return_part_time['id'],
}]
assert len(stage2_mine) == 10, stage2_mine

print(json.dumps({
    'database': 'hr_personnel_demo_test',
    'effectiveDate': effective_date,
    'conversion': {
        'completed': conversion['id'],
        'rollback': rollback_conversion['id'],
        'withdrawn': withdraw_conversion['id'],
        'draft': return_conversion['id'],
        'rejected': reject_conversion['id'],
    },
    'partTime': {
        'ended': part_time['id'],
        'futurePendingEffective': future_part_time['id'],
        'rejected': reject_part_time['id'],
        'withdrawn': withdraw_part_time['id'],
        'draft': return_part_time['id'],
    },
    'approvalRequests': 10,
}, ensure_ascii=False, indent=2))
sys.exit(0)
