$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3001/api'
$passed = 0
$failed = 0

function Check($name, $cond) {
  if ($cond) { $script:passed++; Write-Host "PASS $name" }
  else { $script:failed++; Write-Host "FAIL $name" }
}

function Call($method, $path, $token = $null, $body = $null) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $p = @{ Uri = "$base$path"; Method = $method; Headers = $headers; TimeoutSec = 20 }
  if ($body -ne $null) {
    $p['Body'] = ($body | ConvertTo-Json -Depth 6)
    $p['ContentType'] = 'application/json'
  }
  try {
    $r = Invoke-RestMethod @p
    return @{ ok = $true; status = 200; data = $r }
  } catch {
    $code = 0
    try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    return @{ ok = $false; status = $code; data = $null }
  }
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString().Substring(6)
$adminEmail = "p8admin$ts@example.com"
$revEmail = "p8rev$ts@example.com"
$org2Email = "p8org2$ts@example.com"

# 1 ready
$r = Call 'GET' '/ready'
Check 'ready-up' ($r.ok -and $r.data.status -eq 'ok')

# 2 register admin (returns tokens)
$r = Call 'POST' '/auth/register' $null @{ fullName = 'P8 Admin'; email = $adminEmail; password = 'Secret123!'; organizationName = "P8 Org $ts" }
Check 'register-201' ($r.ok)
$adminToken = $r.data.accessToken
$orgId = $r.data.organization.id
$adminId = $r.data.user.id
Check 'register-shape' ($adminToken.Length -gt 10 -and $orgId.Length -eq 24)

# 3 me
$r = Call 'GET' '/auth/me' $adminToken
Check 'me-200' ($r.ok -and $r.data.user.email -eq $adminEmail)

# 4 create KB
$r = Call 'POST' '/knowledge-bases' $adminToken @{ title = "P8 KB $ts"; slug = "p8-kb-$ts"; visibility = 'internal' }
Check 'kb-create' ($r.ok)
$kbSlug = $r.data.slug

# 5 invite reviewer
$r = Call 'POST' '/users' $adminToken @{ fullName = 'P8 Reviewer'; email = $revEmail; password = 'Secret123!' }
Check 'invite-201' ($r.ok)
$reviewerId = $r.data.user.id

# 6 reviewer login
$r = Call 'POST' '/auth/login' $null @{ email = $revEmail; password = 'Secret123!' }
Check 'reviewer-login' ($r.ok)
$revToken = $r.data.accessToken

# 7 add reviewer to KB
$r = Call 'POST' "/knowledge-bases/$kbSlug/members" $adminToken @{ email = $revEmail; role = 'reviewer' }
Check 'kb-add-reviewer' ($r.ok)

# 8 admin creates draft article
$doc = @{ type = 'doc'; content = @(@{ type = 'paragraph'; content = @(@{ type = 'text'; text = "P8 body $ts" }) }) }
$r = Call 'POST' "/knowledge-bases/$kbSlug/articles" $adminToken @{ title = "P8 Article $ts"; slug = "p8-art-$ts"; contentJson = $doc }
Check 'article-create' ($r.ok -and $r.data.status -eq 'draft')
$artSlug = $r.data.slug
$artId = $r.data.id

# 9 submit for review
$r = Call 'POST' "/knowledge-bases/$kbSlug/articles/$artSlug/submit" $adminToken @{ reviewerId = $reviewerId }
Check 'submit-200' ($r.ok -and $r.data.reviewRequest.status -eq 'pending')
$reqId = $r.data.reviewRequest.id

# 10 reviewer inbox: 1 unread notification
$r = Call 'GET' '/notifications' $revToken
Check 'notif-submitted' ($r.ok -and $r.data.total -eq 1 -and $r.data.unread -eq 1 -and $r.data.items[0].type -eq 'review.submitted')
$subNotifId = $r.data.items[0].id
$r = Call 'GET' '/notifications/unread-count' $revToken
Check 'unread-count-1' ($r.ok -and $r.data.unread -eq 1)

# 11 reviewer marks it read
$r = Call 'PATCH' "/notifications/$subNotifId/read" $revToken
Check 'mark-read' ($r.ok -and $r.data.isRead -eq $true)
$r = Call 'GET' '/notifications/unread-count' $revToken
Check 'unread-count-0' ($r.ok -and $r.data.unread -eq 0)

# 12 reviewer approves
$r = Call 'POST' "/review-requests/$reqId/approve" $revToken @{ comment = 'looks good' }
Check 'approve-200' ($r.ok -and $r.data.article.status -eq 'published')

# 13 admin got approved notification
$r = Call 'GET' '/notifications?isRead=false' $adminToken
Check 'notif-approved' ($r.ok -and $r.data.total -ge 1 -and $r.data.items[0].type -eq 'review.approved')
$apprNotifId = $r.data.items[0].id

# 14 admin read-all
$r = Call 'PATCH' '/notifications/read-all' $adminToken
Check 'read-all' ($r.ok -and $r.data.updated -ge 1)
$r = Call 'GET' '/notifications/unread-count' $adminToken
Check 'admin-unread-0' ($r.ok -and $r.data.unread -eq 0)

# 15 foreign notification read -> 404
$r = Call 'PATCH' "/notifications/$apprNotifId/read" $revToken
Check 'foreign-read-404' (-not $r.ok -and $r.status -eq 404)

# 16 no-token -> 401
$r = Call 'GET' '/notifications'
Check 'notif-no-token-401' (-not $r.ok -and $r.status -eq 401)

# 17 direct manager transition writes history row (Phase 6 debt)
$r = Call 'POST' "/knowledge-bases/$kbSlug/articles" $adminToken @{ title = "P8 Direct $ts"; slug = "p8-direct-$ts"; contentJson = $doc }
Check 'direct-create' ($r.ok)
$dSlug = $r.data.slug
$r = Call 'POST' "/knowledge-bases/$kbSlug/articles/$dSlug/publish" $adminToken
Check 'direct-publish' ($r.ok -and $r.data.status -eq 'published')
$r = Call 'GET' "/knowledge-bases/$kbSlug/articles/$dSlug/history" $adminToken
Check 'direct-history-row' ($r.ok -and $r.data.Count -ge 1 -and $r.data[0].toStatus -eq 'published')

# 18 audit logs as admin
$r = Call 'GET' '/audit-logs?pageSize=100' $adminToken
$actions = @()
if ($r.ok) { $actions = @($r.data.items | ForEach-Object { $_.action }) }
Check 'audit-200' ($r.ok -and $r.data.total -ge 6)
foreach ($a in @('auth.register', 'kb.create', 'article.create', 'review.submitted', 'review.approved', 'article.published')) {
  Check "audit-has-$a" ($actions -contains $a)
}

# 19 audit filter
$r = Call 'GET' '/audit-logs?action=review.approved' $adminToken
Check 'audit-filter' ($r.ok -and $r.data.total -eq 1 -and $r.data.items[0].action -eq 'review.approved')

# 20 audit as non-admin -> 403
$r = Call 'GET' '/audit-logs' $revToken
Check 'audit-reviewer-403' (-not $r.ok -and $r.status -eq 403)

# 21 audit no-token -> 401
$r = Call 'GET' '/audit-logs'
Check 'audit-no-token-401' (-not $r.ok -and $r.status -eq 401)

# 22 second org isolation: empty inbox + empty audit
$r = Call 'POST' '/auth/register' $null @{ fullName = 'P8 Org2'; email = $org2Email; password = 'Secret123!'; organizationName = "P8 Org2 $ts" }
Check 'org2-register' ($r.ok)
$org2Token = $r.data.accessToken
$r = Call 'GET' '/notifications' $org2Token
Check 'org2-inbox-empty' ($r.ok -and $r.data.total -eq 0)
$r = Call 'GET' '/audit-logs' $org2Token
Check 'org2-audit-only-own' ($r.ok -and @($r.data.items | Where-Object { $_.action -eq 'article.create' }).Count -eq 0)

Write-Host "SMOKE done passed=$passed failed=$failed"
if ($failed -gt 0) { exit 1 }
