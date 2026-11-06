$ErrorActionPreference = 'Stop'
$expected = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs/UniversalFileViewer-Prototype')).TrimEnd('\')
if (!(Test-Path -LiteralPath $expected)) { Write-Output 'Prototype is not installed.'; exit 0 }
$resolved = (Resolve-Path -LiteralPath $expected).Path.TrimEnd('\')
if ($resolved -ne $expected) { throw 'Unexpected installation path; refusing cleanup.' }
$marker = Join-Path $resolved '.ufv-prototype-install'
if (!(Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -ne 'UniversalFileViewer-Prototype-v1') { throw 'Installation marker is missing or invalid.' }
# Do not remove any running process or a registration now pointing elsewhere.
$wanted = '"' + (Join-Path $resolved 'UniversalFileViewer.exe') + '" "%1"'
foreach ($key in @('HKCU:\Software\Classes\Applications\UniversalFileViewer.exe','HKCU:\Software\Classes\UniversalFileViewer.Prototype.Text','HKCU:\Software\Classes\UniversalFileViewer.Prototype.Document')) {
    if (Test-Path -LiteralPath $key) {
        if ((Get-Item -LiteralPath "$key\shell\open\command").GetValue('') -ne $wanted) { throw 'An application registration has changed ownership. Refusing cleanup.' }
    }
}
$busy = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($resolved + '\', [StringComparison]::OrdinalIgnoreCase) }
if ($busy) { throw 'Close the prototype and wait for its sessions to expire before uninstalling.' }
foreach ($key in @('HKCU:\Software\Classes\Applications\UniversalFileViewer.exe','HKCU:\Software\Classes\UniversalFileViewer.Prototype.Text','HKCU:\Software\Classes\UniversalFileViewer.Prototype.Document','HKCU:\Software\UniversalFileViewerPrototype')) {
    if (Test-Path -LiteralPath $key) { Remove-Item -LiteralPath $key -Recurse }
}
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Classes\.txt\OpenWithProgids' -Name 'UniversalFileViewer.Prototype.Text' -ErrorAction SilentlyContinue
foreach ($extension in @('.md','.pdf','.png','.jpg','.jpeg','.webp','.docx','.epub','.csv','.tsv','.xlsx')) {
    Remove-ItemProperty -LiteralPath "HKCU:\Software\Classes\$extension\OpenWithProgids" -Name 'UniversalFileViewer.Prototype.Document' -ErrorAction SilentlyContinue
}
Remove-ItemProperty -LiteralPath 'HKCU:\Software\RegisteredApplications' -Name UniversalFileViewerPrototype -ErrorAction SilentlyContinue
# Resolved target verified above and belongs to this marked prototype installation.
Remove-Item -LiteralPath $resolved -Recurse -Force
Write-Output 'Prototype files and its registrations removed. Existing user defaults were not changed.'
