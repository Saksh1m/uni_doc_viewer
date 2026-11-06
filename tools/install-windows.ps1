param([string]$PackagePath = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath($PackagePath)
$target = Join-Path $env:LOCALAPPDATA 'Programs/UniversalFileViewer-Prototype'
$exe = Join-Path $target 'UniversalFileViewer.exe'
$marker = Join-Path $target '.ufv-prototype-install'
$appKey = 'HKCU:\Software\Classes\Applications\UniversalFileViewer.exe'
$progKey = 'HKCU:\Software\Classes\UniversalFileViewer.Prototype.Text'
$documentKey = 'HKCU:\Software\Classes\UniversalFileViewer.Prototype.Document'
$extensions = @('.md','.pdf','.png','.jpg','.jpeg','.webp','.docx','.epub','.csv','.tsv','.xlsx')
$capKey = 'HKCU:\Software\UniversalFileViewerPrototype'
if (!(Test-Path -LiteralPath (Join-Path $source 'UniversalFileViewer.exe'))) { throw 'Run install.ps1 from the built package folder.' }
if ((Test-Path -LiteralPath $target) -and !(Test-Path -LiteralPath $marker)) { throw 'The installation folder exists without this prototype marker. Refusing to overwrite it.' }
if (Test-Path -LiteralPath $marker) {
    $busy = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($target.Replace('/', '\') + '\', [StringComparison]::OrdinalIgnoreCase) }
    if ($busy) { throw 'The prototype is running. Close its tabs and wait for session expiry before installing again. No files were copied.' }
}
foreach ($key in @($appKey, $progKey, $documentKey, $capKey)) {
    if ((Test-Path -LiteralPath $key) -and !(Test-Path -LiteralPath $marker)) { throw "Existing registration at $key is not owned by this installation." }
}
$command = '"' + $exe + '" "%1"'
foreach ($key in @($appKey,$progKey,$documentKey)) {
    if ((Test-Path -LiteralPath $key) -and (Test-Path -LiteralPath $marker)) {
        if (!(Test-Path -LiteralPath "$key\shell\open\command") -or (Get-Item -LiteralPath "$key\shell\open\command").GetValue('') -ne $command) { throw 'An existing handler registration has changed ownership. Refusing to overwrite it.' }
    }
}
New-Item -ItemType Directory -Force -Path $target | Out-Null
'UniversalFileViewer-Prototype-v1' | Set-Content -LiteralPath $marker -Encoding ASCII
if ($source.TrimEnd('\') -ne $target.TrimEnd('\')) {
    Get-ChildItem -LiteralPath $source | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force }
}
$command = '"' + $exe + '" "%1"'
foreach ($key in @("$appKey\shell\open\command", "$appKey\SupportedTypes", "$progKey\shell\open\command", "$capKey\Capabilities\FileAssociations", 'HKCU:\Software\Classes\.txt\OpenWithProgids', 'HKCU:\Software\RegisteredApplications')) { if (!(Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null } }
Set-Item -LiteralPath "$appKey\shell\open\command" -Value $command
New-ItemProperty -LiteralPath $appKey -Name FriendlyAppName -Value 'Universal File Viewer (Prototype)' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath "$appKey\SupportedTypes" -Name '.txt' -Value '' -PropertyType String -Force | Out-Null
Set-Item -LiteralPath $progKey -Value 'Universal File Viewer text document'
Set-Item -LiteralPath "$progKey\shell\open\command" -Value $command
New-ItemProperty -LiteralPath 'HKCU:\Software\Classes\.txt\OpenWithProgids' -Name 'UniversalFileViewer.Prototype.Text' -Value '' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath "$capKey\Capabilities" -Name ApplicationName -Value 'Universal File Viewer (Prototype)' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath "$capKey\Capabilities" -Name ApplicationDescription -Value 'Read local text files in your default browser.' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath "$capKey\Capabilities\FileAssociations" -Name '.txt' -Value 'UniversalFileViewer.Prototype.Text' -PropertyType String -Force | Out-Null
foreach ($key in @($documentKey,"$documentKey\shell\open\command")) { if (!(Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null } }
Set-Item -LiteralPath $documentKey -Value 'Universal File Viewer document'
Set-Item -LiteralPath "$documentKey\shell\open\command" -Value $command
foreach ($extension in $extensions) {
    $openWith = "HKCU:\Software\Classes\$extension\OpenWithProgids"
    if (!(Test-Path -LiteralPath $openWith)) { New-Item -Path $openWith -Force | Out-Null }
    New-ItemProperty -LiteralPath $openWith -Name 'UniversalFileViewer.Prototype.Document' -Value '' -PropertyType String -Force | Out-Null
    New-ItemProperty -LiteralPath "$appKey\SupportedTypes" -Name $extension -Value '' -PropertyType String -Force | Out-Null
    New-ItemProperty -LiteralPath "$capKey\Capabilities\FileAssociations" -Name $extension -Value 'UniversalFileViewer.Prototype.Document' -PropertyType String -Force | Out-Null
}
New-ItemProperty -LiteralPath "$capKey\Capabilities" -Name ApplicationDescription -Value 'Read local documents, images and tables in your default browser.' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath 'HKCU:\Software\RegisteredApplications' -Name UniversalFileViewerPrototype -Value 'Software\UniversalFileViewerPrototype\Capabilities' -PropertyType String -Force | Out-Null
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class UfvNotify { [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint e, uint f, IntPtr a, IntPtr b); }'
[UfvNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "Installed for this user: $exe"
Write-Output 'Use Windows Open with on a supported document, image or text file. Existing defaults were not changed.'
