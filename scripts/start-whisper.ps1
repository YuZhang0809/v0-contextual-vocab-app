# Whisper API 服务启动脚本 (GPU 加速版)
# 使用方法: .\scripts\start-whisper.ps1
# 
# 环境要求:
#   - PyTorch Nightly 2.11+ (支持 RTX 50系列 Blackwell)
#   - CUDA 12.8+

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Whisper API 服务 (RTX 5080 GPU)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 获取项目根目录
$projectRoot = Split-Path -Parent $PSScriptRoot

# 激活虚拟环境
$venvPath = Join-Path $projectRoot "whisper-env\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "激活虚拟环境..." -ForegroundColor Yellow
    . $venvPath
} else {
    Write-Host "错误: 找不到虚拟环境 ($venvPath)" -ForegroundColor Red
    Write-Host "请先运行: python -m venv whisper-env" -ForegroundColor Red
    exit 1
}

# 启动服务器
$serverScript = Join-Path $PSScriptRoot "whisper-server.py"
Write-Host "启动服务器: $serverScript" -ForegroundColor Yellow
Write-Host ""
python $serverScript

