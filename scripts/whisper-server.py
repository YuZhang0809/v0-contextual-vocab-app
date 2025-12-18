"""
Whisper 本地 API 服务器
提供 HTTP API 用于音频转文字

启动方式:
    .\\scripts\\start-whisper.ps1
    # 或手动:
    .\\whisper-env\\Scripts\\Activate.ps1
    python scripts/whisper-server.py

API 端点:
    POST /transcribe - 上传音频文件转录
    POST /transcribe-url - 从 URL 下载音频转录
    GET  /health - 健康检查
"""
import os
import sys
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

# RTX 5080 (Blackwell) 已通过 PyTorch Nightly 2.11+ 支持
# os.environ["CUDA_VISIBLE_DEVICES"] = ""  # 如需禁用 GPU 取消此注释

from fastapi import FastAPI, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import whisper

# ============================================================
# 配置
# ============================================================

MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")  # tiny, base, small, medium, large, turbo
DEVICE = "cuda"  # RTX 5080 (Blackwell sm_120) 已通过 PyTorch Nightly 支持!
HOST = "127.0.0.1"
PORT = 8000

# ============================================================
# FastAPI 应用
# ============================================================

app = FastAPI(
    title="Whisper Local API",
    description="本地部署的 Whisper 语音识别 API",
    version="1.0.0",
)

# CORS 配置 - 允许 Next.js 开发服务器访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
model = None
executor = ThreadPoolExecutor(max_workers=2)


# ============================================================
# 生命周期事件
# ============================================================

@app.on_event("startup")
async def startup_event():
    """应用启动时加载模型"""
    global model
    print(f"\n{'='*50}")
    print(f"正在加载 Whisper 模型: {MODEL_SIZE}")
    print(f"设备: {DEVICE}")
    print(f"{'='*50}\n")
    
    model = whisper.load_model(MODEL_SIZE, device=DEVICE)
    
    print(f"\n✅ 模型加载成功!")
    print(f"API 服务运行在: http://{HOST}:{PORT}")
    print(f"API 文档: http://{HOST}:{PORT}/docs\n")


# ============================================================
# 转录函数
# ============================================================

def transcribe_audio(file_path: str, language: Optional[str] = None) -> dict:
    """
    同步转录函数 (在线程池中执行)
    
    Args:
        file_path: 音频文件路径
        language: 可选语言代码 (en, zh, ja, etc.)
    
    Returns:
        包含 transcript, language, duration 的字典
    """
    options = {}
    if language:
        options["language"] = language
    
    result = model.transcribe(file_path, **options)
    
    # 转换为带时间戳的格式 (兼容 YouTube 字幕格式)
    segments = [
        {
            "text": seg["text"].strip(),
            "offset": int(seg["start"] * 1000),  # 转为毫秒
            "duration": int((seg["end"] - seg["start"]) * 1000),
        }
        for seg in result["segments"]
    ]
    
    return {
        "transcript": segments,
        "language": result["language"],
        "text": result["text"],  # 完整文本
    }


# ============================================================
# API 端点
# ============================================================

@app.post("/transcribe")
async def transcribe_file(
    file: UploadFile,
    language: Optional[str] = Query(None, description="语言代码 (en, zh, ja 等)")
):
    """
    上传音频文件进行转录
    
    支持格式: mp3, wav, m4a, flac, ogg, webm
    """
    # 验证文件类型
    allowed_extensions = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {ext}. 支持: {', '.join(allowed_extensions)}"
        )
    
    # 保存临时文件
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # 在线程池中运行转录 (避免阻塞事件循环)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            transcribe_audio,
            tmp_path,
            language
        )
        return JSONResponse(content=result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")
    
    finally:
        # 清理临时文件
        try:
            os.unlink(tmp_path)
        except:
            pass


@app.post("/transcribe-url")
async def transcribe_from_url(
    url: str,
    language: Optional[str] = Query(None, description="语言代码 (en, zh, ja 等)")
):
    """
    从 URL 下载音频并转录
    
    适用于播客 RSS 中的音频链接
    """
    import urllib.request
    import urllib.error
    
    # 简单验证 URL
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="无效的 URL")
    
    # 下载音频
    try:
        # 获取文件扩展名
        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".mp3"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            print(f"正在下载音频: {url[:100]}...")
            urllib.request.urlretrieve(url, tmp.name)
            tmp_path = tmp.name
            print(f"下载完成，开始转录...")
    
    except urllib.error.URLError as e:
        raise HTTPException(status_code=400, detail=f"下载失败: {str(e)}")
    
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            transcribe_audio,
            tmp_path,
            language
        )
        return JSONResponse(content=result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")
    
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "ready": model is not None
    }


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "Whisper Local API",
        "version": "1.0.0",
        "docs": f"http://{HOST}:{PORT}/docs",
        "endpoints": {
            "POST /transcribe": "上传音频文件转录",
            "POST /transcribe-url": "从 URL 下载音频转录",
            "GET /health": "健康检查"
        }
    }


# ============================================================
# 启动入口
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*50)
    print("Whisper 本地 API 服务器")
    print("="*50)
    print(f"\n🚀 RTX 5080 (Blackwell) GPU 已启用!")
    print(f"PyTorch Nightly + CUDA 12.8 支持 sm_120\n")
    
    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level="info"
    )

