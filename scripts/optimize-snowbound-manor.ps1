$ErrorActionPreference = 'Stop'
& 'D:/python/python.exe' -X utf8 (Join-Path $PSScriptRoot 'optimize-snowbound-manor.py')
if ($LASTEXITCODE -ne 0) { throw 'Snowbound optimization failed; see runtime logs.' }
