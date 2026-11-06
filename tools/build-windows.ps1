$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
& node (Join-Path $PSScriptRoot 'build-renderers.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Renderer asset build failed.' }
$dist = Join-Path $root 'dist/UniversalFileViewer'
New-Item -ItemType Directory -Force -Path $dist, (Join-Path $dist 'runtime'), (Join-Path $dist 'app') | Out-Null
$runtime = (Get-Command node.exe -ErrorAction Stop).Source
$version = & $runtime --version
if ($version -notmatch '^v22\.') { throw 'Build this prototype with Node 22 x64.' }
$arch = & $runtime -p process.arch
if ($arch -ne 'x64') { throw 'Build this prototype with the x64 Node runtime.' }
Copy-Item -LiteralPath $runtime -Destination (Join-Path $dist 'runtime/node.exe') -Force
Get-ChildItem -LiteralPath (Join-Path $root 'src') | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dist 'app') -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $root 'windows/Launcher.exe.config') -Destination (Join-Path $dist 'UniversalFileViewer.exe.config') -Force
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll "/win32manifest:$(Join-Path $root 'windows/app.manifest')" "/out:$(Join-Path $dist 'UniversalFileViewer.exe')" (Join-Path $root 'windows/Launcher.cs') (Join-Path $root 'windows/BrokerHost.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
# Node carries bundled third-party notices in process.release/source distribution.
# Copy the official license shipped alongside the selected runtime when available.
$license = Join-Path (Split-Path $runtime -Parent) 'LICENSE'
if (Test-Path -LiteralPath $license) { Copy-Item -LiteralPath $license -Destination (Join-Path $dist 'NODE-LICENSE.txt') -Force }
else {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/nodejs/node/$version/LICENSE" -OutFile (Join-Path $dist 'NODE-LICENSE.txt') -UseBasicParsing
}
Copy-Item -LiteralPath (Join-Path $root 'tools/install-windows.ps1') -Destination (Join-Path $dist 'install.ps1') -Force
Copy-Item -LiteralPath (Join-Path $root 'tools/uninstall-windows.ps1') -Destination (Join-Path $dist 'uninstall.ps1') -Force
Copy-Item -LiteralPath (Join-Path $root 'docs/prototype-readme.md') -Destination (Join-Path $dist 'README.md') -Force
$files = Get-ChildItem -LiteralPath $dist -File -Recurse | Where-Object { $_.Name -ne 'build-info.json' }
$hashes = @{}
foreach ($file in $files) {
    $stream = [IO.File]::OpenRead($file.FullName)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hashes[$file.FullName.Substring($dist.Length + 1)] = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose(); $sha.Dispose() }
}
@{ version = '0.0.7'; node = $version; architecture = $arch; signed = $false; hashes = $hashes } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $dist 'build-info.json') -Encoding UTF8
Write-Output "Built Windows prototype at $dist"
