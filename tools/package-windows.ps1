$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$package = Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$electronVersion = $package.devDependencies.electron
$outputRoot = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$downloadPath = Join-Path $outputRoot "electron-v$electronVersion-win32-x64.zip"
$appDirectory = Join-Path $outputRoot 'Eightfold-TFT-Overlay-win-x64'
if (Test-Path -LiteralPath $appDirectory) { throw 'Output directory already exists. Choose a clean checkout for packaging.' }
$baseUrl = "https://github.com/electron/electron/releases/download/v$electronVersion"
Invoke-WebRequest -Uri "$baseUrl/electron-v$electronVersion-win32-x64.zip" -OutFile $downloadPath
$checksumPath = Join-Path $outputRoot 'SHASUMS256.txt'
Invoke-WebRequest -Uri "$baseUrl/SHASUMS256.txt" -OutFile $checksumPath
$assetName = "electron-v$electronVersion-win32-x64.zip"
$entryPattern = '^[0-9a-fA-F]{64}\s+\*?' + [regex]::Escape($assetName) + '$'
$hashLines = @(Get-Content -LiteralPath $checksumPath -Encoding utf8 | Where-Object { $_.Trim() -match $entryPattern })
if ($hashLines.Count -ne 1) { throw 'Electron checksum entry missing or ambiguous' }
$expectedHash = ($hashLines[0].Trim() -split '\s+')[0]
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $downloadPath).Hash.ToLowerInvariant() -ne $expectedHash.ToLowerInvariant()) { throw 'Electron checksum mismatch' }
Expand-Archive -LiteralPath $downloadPath -DestinationPath $appDirectory
$appResources = Join-Path $appDirectory 'resources/app'
New-Item -ItemType Directory -Force -Path $appResources | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json') -Destination $appResources
Copy-Item -LiteralPath (Join-Path $projectRoot 'desktop') -Destination $appResources -Recurse
New-Item -ItemType Directory -Force -Path (Join-Path $appResources 'dist') | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'dist/index.html') -Destination (Join-Path $appResources 'dist/index.html')
Copy-Item -LiteralPath (Join-Path $projectRoot 'desktop/README.zh-TW.md') -Destination (Join-Path $appDirectory '使用說明.md')
Rename-Item -LiteralPath (Join-Path $appDirectory 'electron.exe') -NewName 'Eightfold.exe'
$zip = Join-Path $outputRoot 'Eightfold-TFT-Overlay-win-x64.zip'
Compress-Archive -LiteralPath $appDirectory -DestinationPath $zip
Write-Output "Portable Windows application: $zip"
