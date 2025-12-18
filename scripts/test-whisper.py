"""
Whisper 安装验证脚本
验证 GPU 可用性并加载模型
"""
import torch
import whisper

print("=" * 50)
print("Whisper 环境检查")
print("=" * 50)

# 检查 PyTorch 和 CUDA
print(f"\nPyTorch 版本: {torch.__version__}")
print(f"CUDA 可用: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"CUDA 版本: {torch.version.cuda}")
    print(f"GPU 设备: {torch.cuda.get_device_name(0)}")
    print(f"GPU 显存: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
else:
    print("⚠️ CUDA 不可用，将使用 CPU 模式")

# 加载模型
print("\n" + "=" * 50)
print("加载 Whisper 模型 (首次运行会下载模型文件)")
print("=" * 50)

MODEL_SIZE = "base"  # 可选: tiny, base, small, medium, large, turbo
# PyTorch Nightly 2.11+ 已支持 RTX 5080 (Blackwell sm_120)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"\n正在加载 '{MODEL_SIZE}' 模型 (设备: {DEVICE})...")

model = whisper.load_model(MODEL_SIZE, device=DEVICE)
print(f"✅ 模型加载成功!")
print(f"模型运行设备: {model.device}")

print("\n" + "=" * 50)
print("测试完成! Whisper 已准备就绪")
print("=" * 50)

# 可选: 测试转录 (取消注释下面的代码并提供音频文件)
# print("\n测试转录...")
# result = model.transcribe("test_audio.mp3")
# print(f"识别文本: {result['text']}")
# print(f"检测语言: {result['language']}")

