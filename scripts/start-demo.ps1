param(
    [string]$Python = 'python',
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173,
    [switch]$FixtureOnly
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$web = Join-Path $root 'web'
$venvPython = Join-Path $root '.venv\Scripts\python.exe'
$fixture = Join-Path $root 'runs\demo-event\event.json'
$logs = Join-Path $root 'runs\logs'

if ($ApiPort -lt 1 -or $ApiPort -gt 65535 -or $WebPort -lt 1 -or $WebPort -gt 65535 -or $ApiPort -eq $WebPort) {
    throw 'Choose two distinct TCP ports between 1 and 65535.'
}
if ($WebPort -ne 5173) { throw 'The API currently allows dashboard origin port 5173 only.' }

Push-Location $root
try {
    if (-not (Test-Path -LiteralPath $venvPython)) {
        $version = & $Python -c 'import sys; print("%d.%d" % sys.version_info[:2])'
        if ($LASTEXITCODE -ne 0 -or $version -notin @('3.11', '3.12')) {
            throw "Python 3.11 or 3.12 is required; got $version. Pass -Python with its executable path."
        }
        & $Python -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Could not create Python virtual environment.' }
    }
    & $venvPython -m pip install -r requirements-app.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }

    $env:PYTHONPATH = Join-Path $root 'src'
    if (-not (Test-Path -LiteralPath $fixture)) {
        & $venvPython -m nowcast.data generate (Split-Path -Parent $fixture)
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic fixture generation failed.' }
    }
    & $venvPython -m nowcast.data validate $fixture | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic fixture validation failed.' }

    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    $env:NOWCAST_RUNS_DIR = Join-Path $root 'runs\api'
    if ($FixtureOnly) {
        Remove-Item -Path 'Env:NOWCAST_EVENT_BUNDLE_PATH', 'Env:NOWCAST_EVENT_PATH' -ErrorAction SilentlyContinue
    } else {
        $env:NOWCAST_EVENT_BUNDLE_PATH = $fixture
    }
    $env:VITE_API_BASE_URL = "http://127.0.0.1:$ApiPort"
    $env:npm_config_cache = Join-Path $root 'runs\npm-cache'

    Push-Location $web
    try {
        npm ci --cache $env:npm_config_cache
        if ($LASTEXITCODE -ne 0) { throw 'Dashboard dependency installation failed.' }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Dashboard build failed.' }
    } finally { Pop-Location }

    $api = $null
    $dashboard = $null
    try {
        $api = Start-Process -FilePath $venvPython -ArgumentList @('-m', 'uvicorn', 'nowcast.api.app:app', '--host', '127.0.0.1', '--port', "$ApiPort") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'api.stdout.log') -RedirectStandardError (Join-Path $logs 'api.stderr.log') -PassThru
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Seconds 1
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 2
                if ($health.status -eq 'ok') { $ready = $true; break }
            } catch { }
            if ($api.HasExited) { break }
        }
        if (-not $ready) { throw "API did not become ready; inspect $logs\api.stderr.log" }

        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        $dashboard = Start-Process -FilePath $npm -ArgumentList @('run', 'preview', '--', '--host', '127.0.0.1', '--port', "$WebPort") -WorkingDirectory $web -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'web.stdout.log') -RedirectStandardError (Join-Path $logs 'web.stderr.log') -PassThru
        Write-Host "API: http://127.0.0.1:$ApiPort"
        Write-Host "Dashboard: http://127.0.0.1:$WebPort"
        Write-Host 'Synthetic CPU demo. Press Ctrl+C to stop both servers.'
        while (-not $api.HasExited -and -not $dashboard.HasExited) { Start-Sleep -Seconds 1 }
        throw "A demo process exited; inspect $logs"
    } finally {
        $taskkill = Join-Path $env:SystemRoot 'System32\taskkill.exe'
        foreach ($process in @($dashboard, $api)) {
            if ($null -ne $process -and -not $process.HasExited) {
                # npm.cmd and the virtual-environment shim both spawn child
                # processes on Windows, so terminate the whole recorded tree.
                & $taskkill /PID $process.Id /T /F *> $null
            }
        }
    }
} finally { Pop-Location }
