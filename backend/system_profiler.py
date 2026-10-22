import os
import psutil

def get_system_profile() -> dict:
    """
    Quét thông số phần cứng của máy tính và đưa ra khuyến nghị
    cho tác vụ tách nhạc AI (Demucs).
    """
    cpu_count = psutil.cpu_count(logical=True)
    cpu_physical = psutil.cpu_count(logical=False) or cpu_count
    mem = psutil.virtual_memory()
    total_ram_gb = round(mem.total / (1024 ** 3), 2)
    available_ram_gb = round(mem.available / (1024 ** 3), 2)
    cpu_percent = psutil.cpu_percent(interval=None)

    cuda_available = False
    torch_module = None
    try:
        import torch
        torch_module = torch
        cuda_available = torch.cuda.is_available()
    except Exception:
        pass

    gpu_info = {
        "available": False,
        "device_name": "None (CPU Mode)",
        "vram_total_gb": 0.0,
        "vram_free_gb": 0.0
    }

    if cuda_available and torch_module is not None:
        try:
            device_name = torch_module.cuda.get_device_name(0)
            props = torch_module.cuda.get_device_properties(0)
            total_vram = round(props.total_memory / (1024 ** 3), 2)
            mem_reserved = torch_module.cuda.memory_reserved(0)
            free_vram = round((props.total_memory - mem_reserved) / (1024 ** 3), 2)

            gpu_info = {
                "available": True,
                "device_name": device_name,
                "vram_total_gb": total_vram,
                "vram_free_gb": free_vram
            }
        except Exception as e:
            gpu_info["error"] = str(e)

    # Đưa ra khuyến nghị
    if cuda_available and gpu_info["vram_total_gb"] >= 3.5:
        recommendation = "GPU_OPTIMAL"
        message = f"Phát hiện GPU rời ({gpu_info['device_name']}) đủ VRAM. Khuyến nghị chạy Demucs trên GPU (15-30s/bài)."
        suggested_device = "cuda"
    elif total_ram_gb >= 12 and available_ram_gb >= 4:
        recommendation = "CPU_CAPABLE"
        message = f"Chế độ CPU với {cpu_count} luồng. Khuyến nghị giới hạn 2-3 luồng để tránh nghẽn CPU khi đang làm việc."
        suggested_device = "cpu"
    else:
        recommendation = "LOW_SPEC_FALLBACK"
        message = "Cấu hình RAM hoặc CPU ở mức khiêm tốn. Khuyến nghị dùng chế độ Fallback Lo-Fi hoặc chạy Colab script tách trước."
        suggested_device = "cpu"

    return {
        "cpu": {
            "logical_cores": cpu_count,
            "physical_cores": cpu_physical,
            "current_usage_percent": cpu_percent
        },
        "ram": {
            "total_gb": total_ram_gb,
            "available_gb": available_ram_gb,
            "used_percent": mem.percent
        },
        "gpu": gpu_info,
        "recommendation": recommendation,
        "message": message,
        "suggested_device": suggested_device
    }

if __name__ == "__main__":
    import json
    profile = get_system_profile()
    print("=== ADAPTIVE FLOW SYSTEM PROFILER ===")
    print(json.dumps(profile, indent=2, ensure_ascii=False))
