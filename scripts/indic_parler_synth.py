import argparse
import io
import json
import os
import sys
import time

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

MODEL_ID = os.environ.get("INDIC_PARLER_MODEL", "naklitechie/indic-parler-tts")

DEFAULT_SPEAKER_PROMPTS = {
    "Amrita": "Amrita's voice is clear and delivers speech at a normal pace in a close-sounding recording with excellent quality and no background noise.",
    "Rohit": "Rohit speaks with a calm and clear tone in a close environment with no background noise.",
    "Divya": "Divya's voice is monotone yet slightly fast in delivery, with a very close recording that almost has no background noise."
}

def load_model(model_name_or_path=MODEL_ID, device="cpu"):
    import torch
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    if device == "cpu":
        torch.set_num_threads(8)

    t0 = time.time()
    print(f"Loading Indic Parler-TTS model from {model_name_or_path} on {device} (threads: {torch.get_num_threads()})...", file=sys.stderr, flush=True)
    
    # Try local cache or specified path
    model = ParlerTTSForConditionalGeneration.from_pretrained(
        model_name_or_path,
        torch_dtype=torch.float32
    ).to(device)
    model.eval()

    tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)
    
    # Description tokenizer
    encoder_name = model.config.text_encoder._name_or_path
    try:
        desc_tokenizer = AutoTokenizer.from_pretrained(encoder_name)
    except Exception:
        # Fallback to local or base if offline
        desc_tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)

    load_sec = round(time.time() - t0, 2)
    print(f"Model loaded successfully in {load_sec}s", file=sys.stderr, flush=True)
    return model, tokenizer, desc_tokenizer

def synthesize_one(model, tokenizer, desc_tokenizer, text, voice="Amrita", style=None, device="cpu", max_new_tokens=900):
    import torch
    import soundfile as sf
    import numpy as np

    prompt = text.strip()
    if not prompt:
        raise ValueError("Empty text prompt")

    description = style
    if not description:
        base_desc = DEFAULT_SPEAKER_PROMPTS.get(voice, DEFAULT_SPEAKER_PROMPTS["Amrita"])
        description = base_desc

    t0 = time.time()
    desc_inputs = desc_tokenizer(description, return_tensors="pt").to(device)
    prompt_inputs = tokenizer(prompt, return_tensors="pt").to(device)

    with torch.no_grad():
        generation = model.generate(
            input_ids=desc_inputs.input_ids,
            attention_mask=desc_inputs.attention_mask,
            prompt_input_ids=prompt_inputs.input_ids,
            prompt_attention_mask=prompt_inputs.attention_mask,
            max_new_tokens=max_new_tokens
        )
    
    audio_arr = generation.cpu().numpy().squeeze()
    sr = model.config.sampling_rate
    dur_sec = len(audio_arr) / sr
    latency_ms = int((time.time() - t0) * 1000)

    # Encode to WAV buffer
    buf = io.BytesIO()
    sf.write(buf, audio_arr, sr, format="WAV")
    wav_bytes = buf.getvalue()

    return {
        "wav_bytes": wav_bytes,
        "sample_rate": sr,
        "duration_sec": round(dur_sec, 3),
        "latency_ms": latency_ms,
        "audio_arr": audio_arr
    }

def main():
    parser = argparse.ArgumentParser(description="Indic Parler-TTS Nepali synthesis script")
    parser.add_argument("--model", default=MODEL_ID, help="HF model ID or path")
    parser.add_argument("--device", default="cpu", help="Device (cpu or cuda)")
    parser.add_argument("--voice", default="Amrita", help="Speaker name (Amrita, Rohit, Divya)")
    parser.add_argument("--style", default=None, help="Custom style caption")
    parser.add_argument("--text", default=None, help="Text to synthesize")
    parser.add_argument("--out", default=None, help="Output WAV path")
    parser.add_argument("--batch-file", default=None, help="JSON batch file: [{'id':..., 'text':..., 'out':...}]")
    parser.add_argument("--probe", action="store_true", help="Probe if model and imports are available")

    args = parser.parse_args()

    if args.probe:
        try:
            import parler_tts
            import transformers
            import soundfile
            import torch
            print(json.dumps({
                "available": True,
                "parler_tts": parler_tts.__version__,
                "transformers": transformers.__version__,
                "torch": torch.__version__,
                "cuda": torch.cuda.is_available()
            }))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"available": False, "error": str(e)}))
            sys.exit(1)

    model, tokenizer, desc_tokenizer = load_model(args.model, args.device)

    # Single utterance mode
    if args.text and args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        res = synthesize_one(model, tokenizer, desc_tokenizer, args.text, voice=args.voice, style=args.style, device=args.device)
        with open(args.out, "wb") as f:
            f.write(res["wav_bytes"])
        print(json.dumps({
            "ok": True,
            "out": args.out,
            "bytes": len(res["wav_bytes"]),
            "sampleRate": res["sample_rate"],
            "durationSec": res["duration_sec"],
            "latencyMs": res["latency_ms"]
        }))
        sys.exit(0)

    # Batch mode
    if args.batch_file:
        with open(args.batch_file, "r", encoding="utf-8") as f:
            batch = json.load(f)

        results = []
        for idx, item in enumerate(batch):
            cid = item.get("id", f"case_{idx+1}")
            text = item.get("text", "")
            out_path = item.get("out")
            voice = item.get("voice", args.voice)
            style = item.get("style", args.style)

            if out_path and os.path.exists(out_path) and os.path.getsize(out_path) > 44:
                print(f"[{idx+1}/{len(batch)}] {cid} already exists on disk, skipping generation.", file=sys.stderr, flush=True)
                results.append({
                    "id": cid,
                    "ok": True,
                    "text": text,
                    "out": out_path,
                    "bytes": os.path.getsize(out_path),
                    "skipped": True
                })
                continue

            print(f"[{idx+1}/{len(batch)}] Synthesizing {cid}: {text[:30]}...", file=sys.stderr, flush=True)
            try:
                t0 = time.time()
                res = synthesize_one(model, tokenizer, desc_tokenizer, text, voice=voice, style=style, device=args.device)
                if out_path:
                    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                    with open(out_path, "wb") as f:
                        f.write(res["wav_bytes"])
                results.append({
                    "id": cid,
                    "ok": True,
                    "text": text,
                    "out": out_path,
                    "bytes": len(res["wav_bytes"]),
                    "sampleRate": res["sample_rate"],
                    "durationSec": res["duration_sec"],
                    "latencyMs": res["latency_ms"]
                })
            except Exception as e:
                print(f"Error on {cid}: {e}", file=sys.stderr, flush=True)
                results.append({
                    "id": cid,
                    "ok": False,
                    "text": text,
                    "error": str(e)
                })

        print(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        sys.exit(0)

    # Stdin single mode
    stdin_text = sys.stdin.read().strip()
    if stdin_text and args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        res = synthesize_one(model, tokenizer, desc_tokenizer, stdin_text, voice=args.voice, style=args.style, device=args.device)
        with open(args.out, "wb") as f:
            f.write(res["wav_bytes"])
        print(json.dumps({
            "ok": True,
            "out": args.out,
            "bytes": len(res["wav_bytes"]),
            "sampleRate": res["sample_rate"],
            "durationSec": res["duration_sec"],
            "latencyMs": res["latency_ms"]
        }))
        sys.exit(0)

    print(json.dumps({"ok": False, "error": "No text or batch file provided"}))
    sys.exit(1)

if __name__ == "__main__":
    main()
