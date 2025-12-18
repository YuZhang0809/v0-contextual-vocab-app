"""检查 PyTorch GPU 支持"""
import torch

print("=" * 50)
print("PyTorch GPU 检查")
print("=" * 50)

print(f"\nPyTorch 版本: {torch.__version__}")
print(f"CUDA 可用: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"CUDA 版本: {torch.version.cuda}")
    print(f"GPU 设备: {torch.cuda.get_device_name(0)}")
    print(f"GPU 显存: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    print(f"Compute Capability: {torch.cuda.get_device_capability(0)}")
    
    # 测试 GPU 计算
    print("\n测试 GPU 计算...")
    try:
        x = torch.rand(1000, 1000, device='cuda')
        y = torch.matmul(x, x)
        print("✅ GPU 计算测试通过!")
    except Exception as e:
        print(f"❌ GPU 计算失败: {e}")
else:
    print("❌ CUDA 不可用")

print("\n" + "=" * 50)



