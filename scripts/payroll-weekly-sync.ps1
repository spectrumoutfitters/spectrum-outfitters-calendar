param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "https://login.spectrumoutfitters.com",
  [Parameter(Mandatory = $false)]
  [string]$Username = "",
  [Parameter(Mandatory = $false)]
  [string]$Password = "",
  [Parameter(Mandatory = $false)]
  [string]$PayrollHistoryPath = "$env:APPDATA\SpectrumOutfitters-Payroll-System\PayrollData\payroll-history.json",
  [Parameter(Mandatory = $false)]
  [switch]$RunAnyDay
)

$ErrorActionPreference = "Stop"

function Log-Info([string]$msg) {
  Write-Host "[payroll-sync] $msg"
}

function Ensure-SaturdayOrOverride {
  if ($RunAnyDay) { return }
  $today = Get-Date
  if ($today.DayOfWeek -ne [System.DayOfWeek]::Saturday) {
    Log-Info "Skipping sync: today is $($today.DayOfWeek). Use -RunAnyDay to force."
    exit 0
  }
}

function Read-JsonFile([string]$path) {
  if (!(Test-Path -LiteralPath $path)) {
    throw "File not found: $path"
  }
  $raw = Get-Content -LiteralPath $path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "File is empty: $path"
  }
  $parsed = $raw | ConvertFrom-Json
  return ,$parsed
}

function Normalize-Records($parsed) {
  if ($parsed -is [System.Array]) { return $parsed }
  if ($parsed -and $parsed.records) { return $parsed.records }
  if ($parsed -and $parsed.history) { return $parsed.history }
  if ($parsed -and $parsed.data) { return $parsed.data }
  throw "JSON must be an array or object with records/history/data array"
}

function Require-Creds {
  if ([string]::IsNullOrWhiteSpace($Username)) {
    throw "Username is required. Pass -Username or edit script defaults."
  }
  if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "Password is required. Pass -Password or edit script defaults."
  }
}

Ensure-SaturdayOrOverride
Require-Creds

Log-Info "Reading payroll history from: $PayrollHistoryPath"
$parsed = Read-JsonFile $PayrollHistoryPath
$records = Normalize-Records $parsed
if (!($records -is [System.Array]) -or $records.Count -eq 0) {
  throw "No records found in payroll history"
}
Log-Info "Loaded $($records.Count) record(s)"

$loginUrl = "$BaseUrl/api/auth/login"
$importUrl = "$BaseUrl/api/finance/payroll-history-import"
$syncNowUrl = "$BaseUrl/api/finance/payroll-history-sync-now"

Log-Info "Logging in as $Username"
$loginBody = @{
  username = $Username
  password = $Password
} | ConvertTo-Json -Depth 10

$loginResp = Invoke-RestMethod -Method Post -Uri $loginUrl -ContentType "application/json" -Body $loginBody
if (-not $loginResp.token) {
  throw "Login succeeded but no token returned."
}

$token = $loginResp.token
$headers = @{
  Authorization = "Bearer $token"
}

$importBody = @{
  records = $records
} | ConvertTo-Json -Depth 100

Log-Info "Uploading records to $importUrl"
$resp = Invoke-RestMethod -Method Post -Uri $importUrl -Headers $headers -ContentType "application/json" -Body $importBody

$imported = if ($resp.imported -ne $null) { $resp.imported } else { 0 }
$total = if ($resp.total -ne $null) { $resp.total } else { 0 }
Log-Info "Import complete. Imported $imported new pay run(s). Server total: $total."

Log-Info "Triggering sync-now to record weekly split pay runs"
$syncResp = Invoke-RestMethod -Method Post -Uri $syncNowUrl -Headers $headers -ContentType "application/json" -Body "{}"
$splitInserted = if ($syncResp.splitRunsInserted -ne $null) { $syncResp.splitRunsInserted } else { 0 }
$splitWeek = if ($syncResp.splitRunsWeekEnding) { $syncResp.splitRunsWeekEnding } else { "n/a" }
Log-Info "Sync-now complete. Split pay runs added: $splitInserted (week ending $splitWeek)."

