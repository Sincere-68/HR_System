import json
from urllib import request, error, parse
BASE='http://localhost:3102/api/v1'
PASSWORD='Stage2-Local-Only-2026!'
PREFIX='MOCK-HR-STAGE2-'

def call(method,path,token=None,data=None,expected=None):
    body=json.dumps(data,ensure_ascii=False).encode() if data is not None else None
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=request.Request(BASE+path,data=body,headers=headers,method=method)
    try:
        with request.urlopen(req,timeout=30) as r:
            raw=r.read(); status=r.status; payload=json.loads(raw) if raw else None
    except error.HTTPError as e:
        raw=e.read()
        try: payload=json.loads(raw) if raw else None
        except Exception: payload={'raw':raw.decode(errors='replace')}
        status=e.code
    if expected is not None and status != expected:
        raise AssertionError((method,path,status,expected,payload))
    print(method,path,status)
    return payload

def login(suffix):
    result=call('POST','/auth/login',data={'username':PREFIX+suffix,'password':PASSWORD},expected=201)
    return result['accessToken'], result['user']

applicant, applicant_user=login('applicant')
approver1, approver1_user=login('approver-one')
approver2, approver2_user=login('approver-two')
outsider, outsider_user=login('outsider')
# Confirm published flow setup from the browser/API setup.
flows=call('GET','/employment-approval-flows?page=1&pageSize=100',applicant,expected=200)
assert any(x['businessType']=='INTERN_TO_EMPLOYEE' and x['status']=='PUBLISHED' for x in flows['data'])
assert any(x['businessType']=='LABOR_TO_EMPLOYEE' and x['status']=='PUBLISHED' for x in flows['data'])
assert any(x['businessType']=='PART_TIME_RECORD' and x['status']=='PUBLISHED' for x in flows['data'])
# Create a conversion and verify the pending view.
conversion=call('POST','/employment/conversions',applicant,{
    'type':'INTERN_TO_EMPLOYEE','employeeId':'stage2-employee-conversion-happy',
    'sourceEmploymentPeriodId':'stage2-period-conversion-happy',
    'targetOrganizationId':'stage2-organization-b','targetPositionId':'stage2-position-b',
    'targetJobTitleId':'stage2-job-title-b','targetJobLevel':'S3','plannedEffectiveDate':'2026-09-24'
},expected=201)
assert conversion['status']=='PENDING'
conversion_id=conversion['id']; approval_id=conversion['approvalRequestId']
listed=call('GET','/employment/conversions?view=in_progress&type=INTERN_TO_EMPLOYEE&page=1&pageSize=100',applicant,expected=200)
assert any(x['id']==conversion_id for x in listed['data'])
# Scope check before actions.
call('GET','/employment-approvals/'+approval_id,outsider,expected=403)
# Serial approval and pending-effective boundary.
step1=call('POST','/employment-approvals/'+approval_id+'/approve',approver1,{'comment':'浏览器验收一级通过'},expected=201)
assert step1['currentStep']==2 and step1['employmentStatus']=='PENDING'
step2=call('POST','/employment-approvals/'+approval_id+'/approve',approver2,{'comment':'浏览器验收二级通过'},expected=201)
assert step2['employmentStatus']=='PENDING_EFFECTIVE'
pending=call('GET','/employment/conversions/'+conversion_id,applicant,expected=200)
assert pending['status']=='PENDING_EFFECTIVE' and pending['canActivate'] is True
completed=call('POST','/employment/conversions/'+conversion_id+'/activate',applicant,expected=201)
assert completed['status']=='COMPLETED'
# Part-time lifecycle.
part=call('POST','/employment/part-time-records',applicant,{
    'employeeId':'stage2-employee-part-time-happy','type':'浏览器验收项目顾问',
    'institution':PREFIX+'BROWSER','organizationId':'stage2-organization-a',
    'jobTitleId':'stage2-job-title-a','managerEmployeeId':'stage2-employee-manager',
    'startDate':'2026-09-24'
},expected=201)
assert part['status']=='PENDING'
part_id=part['id']; part_approval=part['approvalRequestId']
call('POST','/employment-approvals/'+part_approval+'/approve',approver1,{'comment':'兼职一级通过'},expected=201)
part_step2=call('POST','/employment-approvals/'+part_approval+'/approve',approver2,{'comment':'兼职二级通过'},expected=201)
assert part_step2['employmentStatus']=='PENDING_EFFECTIVE'
part_pending=call('GET','/employment/part-time-records/'+part_id,applicant,expected=200)
assert part_pending['status']=='PENDING_EFFECTIVE' and part_pending['canActivate'] is True
part_active=call('POST','/employment/part-time-records/'+part_id+'/activate',applicant,expected=201)
assert part_active['status']=='ACTIVE'
part_ended=call('POST','/employment/part-time-records/'+part_id+'/end',applicant,{'endDate':'2026-09-24'},expected=201)
assert part_ended['status']=='ENDED'
# Six view/list and approval workbench checks.
for view in ('active','expiring','not_started','ended','approval','all'):
    rows=call('GET','/employment/part-time-records?view='+view+'&page=1&pageSize=100',applicant,expected=200)
    assert isinstance(rows['data'],list)
my=call('GET','/employment-approvals/my?page=1&pageSize=100',applicant,expected=200)
assert any(x['businessId']==conversion_id for x in my['data'])
assert any(x['businessId']==part_id for x in my['data'])
counts=call('GET','/employment/view-counts',applicant,expected=200)
print(json.dumps({'conversion':completed,'partTime':part_ended,'approvalRequestsFound':len(my['data']),'counts':counts},ensure_ascii=False,indent=2))
