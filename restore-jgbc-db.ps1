# restore-jgbc-db.ps1
# Downloads the latest jgbc-db backup from the remote server,
# extracts it to C:\data\db, and runs mongorestore.
#
# Requirements:
#   - OpenSSH client (built into Windows 10/11)
#   - tar (built into Windows 10 build 17063+)
#   - mongorestore (MongoDB Database Tools)
#
# Usage:
#   .\restore-jgbc-db.ps1                          # auto-detect latest backup
#   .\restore-jgbc-db.ps1 -File jgbc-db_20260221_143000.tar.gz  # specific file

param(
    [string]$File = ""   # Optional: specify a filename to skip auto-detection
)

$ErrorActionPreference = "Stop"

# --- Configuration ---
$REMOTE_HOST    = "user@your-server.example.com"  # PLACEHOLDER
$REMOTE_PATH    = "/backups/"                      # PLACEHOLDER
$SSH_KEY_PATH   = "C:\path\to\your\ssh\key.pem"   # PLACEHOLDER
$MONGO_HOST     = "localhost"
$MONGO_PORT     = 27017

$LOCAL_WORK_DIR = "C:\Temp\jgbc-restore"
$RESTORE_DIR    = "C:\data\db"

function Run-Sftp($batchCommands) {
    $batchFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $batchFile -Value $batchCommands -Encoding UTF8
    try {
        $output = & sftp -i $SSH_KEY_PATH -o StrictHostKeyChecking=no -b $batchFile $REMOTE_HOST 2>&1
        return $output
    } finally {
        Remove-Item $batchFile -ErrorAction SilentlyContinue
    }
}

# --- Step 1: Resolve which backup file to download ---
if ($File) {
    $targetFile = $File
    Write-Host "[1/4] Using specified file: $targetFile"
} else {
    Write-Host "[1/4] Listing remote backups at ${REMOTE_HOST}:${REMOTE_PATH}..."

    $listing = Run-Sftp "ls $REMOTE_PATH"

    $targetFile = $listing |
        Where-Object   { $_ -match "jgbc-db_\d{8}_\d{6}\.tar\.gz" } |
        ForEach-Object { [regex]::Match($_, "jgbc-db_\d{8}_\d{6}\.tar\.gz").Value } |
        Sort-Object -Descending |
        Select-Object -First 1

    if (-not $targetFile) {
        Write-Error "No files matching jgbc-db_*.tar.gz found on remote server."
        exit 1
    }

    Write-Host "      Latest backup found: $targetFile"
}

# --- Step 2: Download the archive ---
Write-Host "[2/4] Downloading $targetFile..."

New-Item -ItemType Directory -Force -Path $LOCAL_WORK_DIR | Out-Null
$localArchive = Join-Path $LOCAL_WORK_DIR $targetFile

Run-Sftp "get ${REMOTE_PATH}${targetFile} $($localArchive -replace '\\', '/')" | Out-Null

if (-not (Test-Path $localArchive)) {
    Write-Error "Download failed — file not found at $localArchive after sftp."
    exit 1
}

$sizeMB = [math]::Round((Get-Item $localArchive).Length / 1MB, 2)
Write-Host "      Downloaded to: $localArchive ($sizeMB MB)"

# --- Step 3: Extract into C:\data\db ---
Write-Host "[3/4] Extracting archive to $RESTORE_DIR..."

if (Test-Path $RESTORE_DIR) {
    $confirm = Read-Host "      WARNING: $RESTORE_DIR already exists. Overwrite? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Aborted by user."
        exit 0
    }
    Remove-Item -Recurse -Force $RESTORE_DIR
}

New-Item -ItemType Directory -Force -Path $RESTORE_DIR | Out-Null
tar -xzf $localArchive -C $RESTORE_DIR

if ($LASTEXITCODE -ne 0) {
    Write-Error "tar extraction failed (exit code $LASTEXITCODE)."
    exit 1
}

Write-Host "      Extraction complete."

# --- Step 4: Run mongorestore ---
Write-Host "[4/4] Running mongorestore from $RESTORE_DIR..."

mongorestore --host $MONGO_HOST --port $MONGO_PORT --db jgbc --dir (Join-Path $RESTORE_DIR "jgbc")

if ($LASTEXITCODE -ne 0) {
    Write-Error "mongorestore failed (exit code $LASTEXITCODE)."
    exit 1
}

# --- Cleanup ---
Write-Host ""
Write-Host "Cleaning up temporary files..."
Remove-Item -Recurse -Force $LOCAL_WORK_DIR

Write-Host ""
Write-Host "Done. MongoDB restore from '$targetFile' completed successfully."
