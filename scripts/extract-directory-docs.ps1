param(
  [string]$Source = (Join-Path $PSScriptRoot '..\directory'),
  [string]$Out = (Join-Path $env:TEMP 'zbm')
)
$Source = (Resolve-Path $Source).Path
New-Item -ItemType Directory -Force $Out | Out-Null
$w = New-Object -ComObject Word.Application
$w.Visible = $false
try {
  foreach ($f in Get-ChildItem $Source -Filter *.doc*) {
    $d = $w.Documents.Open($f.FullName, $false, $true)
    $lines = foreach ($p in $d.Paragraphs) { $p.Range.Text -replace "[\r\a]", '' -replace "\x0b", ' | ' }
    [IO.File]::WriteAllLines((Join-Path $Out ($f.BaseName + '.txt')), $lines, [Text.Encoding]::UTF8)
    $d.Close($false)
  }
} finally { $w.Quit() }
Write-Output "Extracted to $Out"
