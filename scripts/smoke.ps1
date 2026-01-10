param(
  [string]$Base = "http://localhost:4001",
  [string]$Key = "leleka-dev",
  [string]$Origin = "http://127.0.0.1:5500"
)

Write-Host "== Health"
Invoke-WebRequest "$Base/v1/health" -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host "== Public config"
Invoke-WebRequest "$Base/v1/projects/$Key/public-config" -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host "== CORS preflight"
$headers = @{ "Origin" = $Origin; "Access-Control-Request-Method" = "GET" }
$resp = Invoke-WebRequest "$Base/v1/projects/$Key/public-config" -Method OPTIONS -Headers $headers -UseBasicParsing
Write-Host "Status: $($resp.StatusCode)"
$resp.Headers | Format-Table -AutoSize

Write-Host "== Chat"
$headers = @{ "Origin" = $Origin; "Content-Type" = "application/json"; "X-Project-Key" = $Key }
$body = @{ message = "Тест smoke"; history = @() } | ConvertTo-Json -Compress
Invoke-WebRequest "$Base/v1/chat" -Method POST -Headers $headers -Body $body -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host "== Widget asset"
$resp = Invoke-WebRequest "$Base/widget/widget.js" -Method HEAD -UseBasicParsing
Write-Host "Status: $($resp.StatusCode)"
$resp.Headers | Format-Table -AutoSize

Write-Host "== Metrics"
Invoke-WebRequest "$Base/v1/metrics" -UseBasicParsing | Select-Object -ExpandProperty Content

Write-Host "OK"
