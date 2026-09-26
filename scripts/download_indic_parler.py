import time
import os
import sys
from huggingface_hub import hf_hub_download

print("Starting robust download of model.safetensors...")
repo_id = "naklitechie/indic-parler-tts"
filename = "model.safetensors"

for attempt in range(1, 31):
    try:
        print(f"\n[Attempt {attempt}/30] Calling hf_hub_download...", flush=True)
        path = hf_hub_download(repo_id=repo_id, filename=filename, resume_download=True)
        print(f"\nSUCCESS! Downloaded and verified at: {path}", flush=True)
        size_mb = round(os.path.getsize(path) / 1024 / 1024, 2)
        print(f"File size: {size_mb} MB", flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"Transient error on attempt {attempt}: {e}", flush=True)
        time.sleep(2)

print("Failed after 30 attempts", flush=True)
sys.exit(1)
