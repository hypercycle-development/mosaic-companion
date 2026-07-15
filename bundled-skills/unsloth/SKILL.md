---
name: unsloth
description: "Unsloth: 2-5x faster LoRA/QLoRA fine-tuning, less VRAM."
version: 1.1.0
author: Orchestra Research
license: MIT
dependencies: [unsloth, torch, transformers, trl, datasets, peft]
metadata:
  hermes:
    tags: [Fine-Tuning, Unsloth, Fast Training, LoRA, QLoRA, Memory-Efficient, Optimization, Llama, Mistral, Gemma, Qwen]

---

# Unsloth Skill

Comprehensive assistance with unsloth development, generated from official documentation.

## When to Use This Skill

This skill should be triggered when:
- Working with unsloth
- Asking about unsloth features or APIs
- Implementing unsloth solutions
- Debugging unsloth code
- Learning unsloth best practices

## Quick Reference

### Common Patterns

*Quick reference patterns will be added as you use the skill.*

## Reference Files

This skill includes comprehensive documentation in `references/`:

- **llms-txt.md** - Llms-Txt documentation

Use `view` to read specific reference files when detailed information is needed.

## Working with This Skill

### For Beginners
Start with the getting_started or tutorials reference files for foundational concepts.

### For Specific Features
Use the appropriate category reference file (api, guides, etc.) for detailed information.

### For Code Examples
The quick reference section above contains common patterns extracted from the official docs.

## Resources

### references/
Organized documentation extracted from official sources. These files contain:
- Detailed explanations
- Code examples with language annotations
- Links to original documentation
- Table of contents for quick navigation

### scripts/
Add helper scripts here for common automation tasks.

### assets/
Add templates, boilerplate, or example projects here.

## Notes

- This skill was automatically generated from official documentation
- Reference files preserve the structure and examples from source docs
- Code examples include language detection for better syntax highlighting
- Quick reference patterns are extracted from common usage examples in the docs

## Updating

To refresh this skill with updated documentation:
1. Re-run the scraper with the same configuration
2. The skill will be rebuilt with the latest information

<!-- Trigger re-upload 1763621536 -->

## Practical Quick Start: Unsloth GRPO

```python
from unsloth import FastLanguageModel
from trl import GRPOConfig, GRPOTrainer

# 1. Load 4-bit model
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Llama-3.2-3B-Instruct",
    max_seq_length=4096,
    load_in_4bit=True,
)

# 2. Add LoRA
model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=16)

# 3. Define reward function
def reward_len(prompts, completions, **kwargs):
    return [len(c) for c in completions]

# 4. Train with GRPO
trainer = GRPOTrainer(
    model=model,
    reward_funcs=reward_len,
    args=GRPOConfig(output_dir="grpo_out", per_device_train_batch_size=1),
    train_dataset=dataset,
)
trainer.train()

# 5. Save to GGUF for Ollama
model.save_pretrained_gguf("./model", tokenizer, quantization_method="q4_k_m")
```

> **Key Unsloth advantage:** GRPO requires loading the model **twice** (base + policy). Unsloth's custom kernels make this ~4x faster and use ~60% less VRAM than standard HF+TRL.

## Integration with Related Skills

| Task | Recommended Skill | Why |
|------|-------------------|-----|
| YAML-based declarative training | `mlops/training/axolotl` | No code needed, just YAML |
| RL alignment (DPO, GRPO, PPO) | `mlops/training/trl-fine-tuning` | TRL handles preference learning |
| Structured eval outputs | `mlops/inference/outlines` | JSON schema from reward function |
| High-throughput serving | `mlops/inference/vllm` | Serve fine-tuned models at scale |
| Local GGUF inference | `mlops/inference/llama-cpp` | Run on CPU / edge devices |

## Self-Test Scenarios

### Scenario 1: Fast QLoRA Fine-tune on RTX 4090
- **Goal:** Fine-tune Llama-3.2-8B with QLoRA on single RTX 4090 (24GB).
- **Steps:** `FastLanguageModel.from_pretrained(..., load_in_4bit=True)` → `get_peft_model(r=16)` → `SFTTrainer`.
- **Verify:** Training starts without OOM. `nvidia-smi` shows <22GB VRAM. Loss decreases.

### Scenario 2: GRPO Reasoning Model
- **Goal:** Train a reasoning model on math problems with GRPO.
- **Steps:** Load base model with Unsloth. Define custom reward (accuracy + format). Use `GRPOTrainer`.
- **Verify:** Reward increases over training. Completions follow expected format.

### Scenario 3: Vision RL (VLM)
- **Goal:** Fine-tune vision-language model (LLaVA-style) with RL.
- **Steps:** Use `unsloth` vision model loader. Create reward for image-caption alignment. Train with `GRPOTrainer`.
- **Verify:** Vision encoder weights update. Model generates coherent captions for held-out images.

### Scenario 4: Export to Ollama
- **Goal:** Deploy fine-tuned model locally via Ollama.
- **Steps:** `save_pretrained_gguf(..., quantization_method="q4_k_m")`. Copy to `~/.ollama/models/`. Create Modelfile.
- **Verify:** `ollama run my-model:latest` → prompt → coherent completion.

### Scenario 5: Multi-GPU Data Parallel
- **Goal:** Train on 4xA100 with Unsloth.
- **Steps:** Use `accelerate launch --multi_gpu` with Unsloth model. Set `per_device_train_batch_size` per GPU.
- **Verify:** `nvidia-smi` on all 4 cards shows ~80%+ utilization. Global throughput >4x single GPU.

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-05-12 | Initial skill auto-generated from Unsloth docs |
| 1.1.0 | 2026-05-13 | Added practical GRPO quick start, cross-references, scenarios, version history |



