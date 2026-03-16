# deploy.ps1
# Automates Cloud Run deployment while preserving .env variables

$prj = "gen-lang-client-0636418324"
$svc = "the-assembly"
$region = "us-west1"

Write-Host "Reading environment variables from .env..." -ForegroundColor Cyan

$envVars = @()
Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $envVars += $line
    }
}

# Add NODE_ENV if not in .env
if (-not ($envVars -match "NODE_ENV")) {
    $envVars += "NODE_ENV=production"
}

$envString = $envVars -join ","

Write-Host "Deploying to Cloud Run ($svc)..." -ForegroundColor Cyan
gcloud run deploy $svc `
    --source . `
    --project $prj `
    --region $region `
    --set-env-vars=$envString `
    --allow-unauthenticated

Write-Host "`nDeployment Complete!" -ForegroundColor Green
