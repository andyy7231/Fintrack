# Read current file
$lines = Get-Content "services\ai\provider.ts"

# Find the start and end of inferCategoryHint function
$startLine = -1
$endLine = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'export function inferCategoryHint') {
        $startLine = $i
    }
    if ($startLine -ge 0 -and $lines[$i] -match '^\s*return "Lainnya";') {
        $endLine = $i
        break
    }
}

Write-Host "Found function from line $startLine to $endLine"
Write-Host "Line $startLine`: $($lines[$startLine])"
Write-Host "Line $endLine`: $($lines[$endLine])"
