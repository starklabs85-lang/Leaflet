# Phase 14 verification via curl --resolve (works around local DNS not
# resolving the project subdomain). Prints no secrets.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envLines = Get-Content (Join-Path $root ".env") | Where-Object { $_ -match "=" -and -not $_.StartsWith("#") }
$envMap = @{}
foreach ($line in $envLines) {
  $index = $line.IndexOf("=")
  $envMap[$line.Substring(0, $index).Trim()] = $line.Substring($index + 1).Trim()
}

$supabaseUrl = $envMap["EXPO_PUBLIC_SUPABASE_URL"]
$anonKey = $envMap["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
$email = $envMap["EXPO_PUBLIC_DEV_TEST_EMAIL"]
$password = $envMap["EXPO_PUBLIC_DEV_TEST_PASSWORD"]
$domain = ([Uri]$supabaseUrl).Host
$resolve = "${domain}:443:104.18.38.10"
$localDate = Get-Date -Format "yyyy-MM-dd"

if (-not $anonKey -or -not $email -or -not $password) {
  Write-Output "SKIP: missing env values."
  exit 0
}

# 1. Sign in
$signInBody = @{ email = $email; password = $password } | ConvertTo-Json -Compress
$signIn = curl.exe -s --resolve $resolve -X POST "$supabaseUrl/auth/v1/token?grant_type=password" -H "Content-Type: application/json" -H "apikey: $anonKey" -d $signInBody | ConvertFrom-Json
if (-not $signIn.access_token) {
  Write-Output "FAIL: sign-in did not return a token."
  exit 1
}
$token = $signIn.access_token
Write-Output "sign-in: ok"

function Invoke-WeatherTips($body) {
  $start = Get-Date
  $raw = curl.exe -s -w "`n%{http_code}" --resolve $resolve -X POST "$supabaseUrl/functions/v1/weather-tips" -H "Content-Type: application/json" -H "apikey: $anonKey" -H "Authorization: Bearer $token" -d $body
  $ms = [int]((Get-Date) - $start).TotalMilliseconds
  $parts = $raw -split "`n"
  $status = $parts[-1]
  $json = ($parts[0..($parts.Length - 2)] -join "`n")
  return @{ status = $status; ms = $ms; json = $json }
}

# 2. Valid request (Berlin)
$validBody = '{"latitude":52.52,"longitude":13.41,"localDate":"' + $localDate + '"}'
$first = Invoke-WeatherTips $validBody
Write-Output ("first call: " + $first.status + " " + $first.ms + "ms")
if ($first.status -ne "200") {
  Write-Output ("FAIL body: " + $first.json.Substring(0, [Math]::Min(400, $first.json.Length)))
  exit 1
}
$data = $first.json | ConvertFrom-Json
Write-Output ("weather: " + $data.weather.timezone + " today " + $data.weather.today.minTemp + ".." + $data.weather.today.maxTemp + "C current " + $data.weather.current.temperature + "C")
Write-Output ("tips: " + $data.tips.Count)
foreach ($tip in $data.tips) {
  $plantLabel = if ($tip.plantName) { $tip.plantName } else { "all plants" }
  $actionLabel = if ($tip.action) { $tip.action.kind } else { "none" }
  Write-Output (" - [" + $tip.severity + "] " + $tip.signal + " (" + $plantLabel + ", phrased=" + $tip.phrased + ", notify=" + $tip.notify + ", action=" + $actionLabel + ")")
  Write-Output ("   " + $tip.message)
}

# 3. Same-day repeat: expect cached snapshot (same fetchedAt)
$second = Invoke-WeatherTips $validBody
$secondData = $second.json | ConvertFrom-Json
$cacheNote = if ($secondData.weather.fetchedAt -eq $data.weather.fetchedAt) { "(cache hit: same snapshot)" } else { "(snapshot differs)" }
Write-Output ("second call: " + $second.status + " " + $second.ms + "ms " + $cacheNote)

# 4. Invalid body -> 400
$bad = Invoke-WeatherTips '{"latitude":"x"}'
Write-Output ("invalid request: " + $bad.status)

# 5. No auth -> 401
$unauthStatus = curl.exe -s -o NUL -w "%{http_code}" --resolve $resolve -X POST "$supabaseUrl/functions/v1/weather-tips" -H "Content-Type: application/json" -H "apikey: $anonKey" -d $validBody
Write-Output ("no-auth request: " + $unauthStatus)

Write-Output "VERIFY DONE"
