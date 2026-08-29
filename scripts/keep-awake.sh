#!/bin/bash
# keep_awake.sh — keep the Windows host awake for N minutes, then allow sleep again.
# Usage:  ./keep_awake.sh [minutes]     (default 120 = 2 hours)

MINUTES="${1:-120}"
SECONDS=$((MINUTES * 60))

# Prefer the full path; fall back to PATH lookup
PWSH="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
[ -x "$PWSH" ] || PWSH="powershell.exe"

echo ">> Keeping system awake for $MINUTES minutes..."
echo ">> Press Ctrl+C to release the lock early."

"$PWSH" -NoProfile -ExecutionPolicy Bypass -Command "
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class P { [DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f); }';
[P]::SetThreadExecutionState(0x80000001) | Out-Null;
Write-Host ('Awake lock active for {0} minutes...' -f $MINUTES);
Start-Sleep -Seconds $SECONDS;
[P]::SetThreadExecutionState(0x80000000) | Out-Null;
Write-Host 'Done. Sleep re-enabled.';
"