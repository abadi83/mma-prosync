# ================================================================
# MMA ProSync - Deploy 1-klik ke VPS (erp-mma.tech)
# Cara pakai:  .\deploy.ps1 "pesan commit (opsional)"
# ================================================================

param(
  [string]$Message = "deploy: update"
)

$ErrorActionPreference = "Stop"

$VPS_HOST = "root@72.62.196.129"
$VPS_PATH = "/home/mma-prosync"
$APP_NAME = "mma-prosync"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  MMA ProSync - Deploy ke VPS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Git: add, commit, push ---
Write-Host "[1/4] Commit + push ke GitHub..." -ForegroundColor Yellow
git add -A
$changes = git status --porcelain
if ($changes) {
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { Write-Host "Gagal commit." -ForegroundColor Red; exit 1 }
} else {
  Write-Host "      Tidak ada perubahan - skip commit." -ForegroundColor DarkGray
}
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal push." -ForegroundColor Red; exit 1 }
Write-Host "      Pushed OK" -ForegroundColor Green

# --- 2. SSH ke VPS: pull + install + build + restart ---
Write-Host "[2/4] SSH ke VPS (ketik password root kalau diminta)..." -ForegroundColor Yellow
Write-Host "      Menunggu password SSH..." -ForegroundColor DarkGray

$remoteCmd = "set -e; cd $VPS_PATH; git pull origin main; npm install --no-audit --no-fund; rm -rf .next; npm run build; pm2 restart $APP_NAME; pm2 save; pm2 status"

ssh $VPS_HOST $remoteCmd
if ($LASTEXITCODE -ne 0) { Write-Host "SSH gagal." -ForegroundColor Red; exit 1 }

# --- 3. Verifikasi ---
Write-Host "[3/4] Verifikasi website..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$code = curl.exe -s -o NUL -w "%{http_code}" --max-time 20 "https://erp-mma.tech/login"
if ($code -eq "200") {
  Write-Host "      erp-mma.tech online (HTTP $code)" -ForegroundColor Green
} else {
  Write-Host "      Website merespon HTTP $code - cek: pm2 logs $APP_NAME" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deploy selesai!" -ForegroundColor Green
Write-Host "  https://erp-mma.tech" -ForegroundColor Cyan
Write-Host ""
