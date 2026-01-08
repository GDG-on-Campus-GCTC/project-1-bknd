# Test 1: Register with valid @gcet.edu.in email
Write-Host "`n=== Test 1: Register with valid @gcet.edu.in email ===" -ForegroundColor Cyan
$body1 = @{
    email = "testuser@gcet.edu.in"
    password = "Test123!"
    displayName = "Test User"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method POST -Body $body1 -ContentType "application/json"
    Write-Host "SUCCESS:" -ForegroundColor Green
    $response1 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    }
}

# Test 2: Register with invalid domain (should fail)
Write-Host "`n=== Test 2: Register with invalid domain (@gmail.com) ===" -ForegroundColor Cyan
$body2 = @{
    email = "testuser@gmail.com"
    password = "Test123!"
    displayName = "Invalid User"
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method POST -Body $body2 -ContentType "application/json"
    Write-Host "SUCCESS:" -ForegroundColor Green
    $response2 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "EXPECTED ERROR:" -ForegroundColor Yellow
    $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    }
}

# Test 3: Login with correct credentials
Write-Host "`n=== Test 3: Login with correct credentials ===" -ForegroundColor Cyan
$body3 = @{
    email = "testuser@gcet.edu.in"
    password = "Test123!"
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -Body $body3 -ContentType "application/json" -SessionVariable session
    Write-Host "SUCCESS:" -ForegroundColor Green
    $response3 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    }
}

# Test 4: Login with incorrect password
Write-Host "`n=== Test 4: Login with incorrect password ===" -ForegroundColor Cyan
$body4 = @{
    email = "testuser@gcet.edu.in"
    password = "WrongPassword123"
} | ConvertTo-Json

try {
    $response4 = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -Body $body4 -ContentType "application/json"
    Write-Host "SUCCESS:" -ForegroundColor Green
    $response4 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "EXPECTED ERROR:" -ForegroundColor Yellow
    $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    }
}

# Test 5: Check auth status
Write-Host "`n=== Test 5: Check authentication status ===" -ForegroundColor Cyan
try {
    $response5 = Invoke-RestMethod -Uri "http://localhost:3000/auth/status" -Method GET -ContentType "application/json"
    Write-Host "SUCCESS:" -ForegroundColor Green
    $response5 | ConvertTo-Json -Depth 10
} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    }
}

Write-Host "`n=== All Tests Complete ===" -ForegroundColor Green
