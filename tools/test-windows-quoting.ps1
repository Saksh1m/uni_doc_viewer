$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root 'dist/UniversalFileViewer'
$assembly = [Reflection.Assembly]::LoadFile((Join-Path $dist 'UniversalFileViewer.exe'))
$method = $assembly.GetType('Launcher').GetMethod('Quote', [Reflection.BindingFlags]'NonPublic,Static')
$quote = [Delegate]::CreateDelegate([Func[string,string]], $method)
$manifest = Get-Content -LiteralPath (Join-Path $root 'tests/fixtures/generated/manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$probe = Join-Path $root 'tests/results/argv-probe.cjs'
New-Item -ItemType Directory -Path (Split-Path $probe -Parent) -Force | Out-Null
'process.stdout.write(JSON.stringify(process.argv.slice(2)))' | Set-Content -LiteralPath $probe -Encoding ASCII
foreach ($id in @('TXT-01','PATH-01','PATH-02','PATH-03')) {
    $fixture = $manifest.fixtures | Where-Object { $_.id -eq $id }
    $path = [IO.Path]::GetFullPath((Join-Path $root ('tests/fixtures/generated/' + $fixture.path)))
    $quotedProbe = $quote.Invoke($probe)
    $quotedFile = $quote.Invoke($path)
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = Join-Path $dist 'runtime/node.exe'
    $start.Arguments = $quotedProbe + ' -- ' + $quotedFile
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.StandardOutputEncoding = [Text.Encoding]::UTF8
    $child = [Diagnostics.Process]::Start($start)
    $received = $child.StandardOutput.ReadToEnd() | ConvertFrom-Json
    $child.WaitForExit()
    if ($child.ExitCode -ne 0 -or $received.Count -ne 2 -or $received[0] -ne '--' -or $received[1] -cne $path) { throw "Native argument transport failed for $id" }
    Write-Output "PASS native argument transport: $id"
}
