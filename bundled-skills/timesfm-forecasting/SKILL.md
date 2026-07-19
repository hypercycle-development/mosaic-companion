---
name: timesfm-forecasting
description: "Zero-shot univariate time-series forecasting with Google TimesFM foundation model. Includes preflight system checker, covariate forecasting (XReg), quantile prediction intervals, and CSV/DataFrame/array inputs."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [data-science, external-repo, integration]
    homepage: https://github.com/
    related_skills: [hermes-agent, native-mcp]
---

# TimesFM Forecasting

TimesFM (Time Series Foundation Model) is a pretrained decoder-only foundation model by Google Research for zero-shot univariate time-series forecasting.

## When to use

- Forecasting sales, demand, sensor readings, prices, energy, vitals, weather, scientific measurements.
- You want zero-shot probabilistic forecasts with calibrated quantile prediction intervals.
- You need batch forecasting for hundreds/thousands of series.
- You have exogenous variables (price, promotions, holidays) → use `forecast_with_covariates()`.

## System requirements

- **TimesFM 2.5**: 200M params, ~800 MB disk, ~1.5 GB RAM (CPU) / ~1 GB VRAM (GPU).
- Python 3.10+.
- Always run the preflight checker first:
  ```bash
  python scripts/check_system.py
  ```

## Installation

```bash
uv pip install timesfm[torch]
# or
pip install timesfm[torch]

# For covariate (XReg) support:
uv pip install timesfm[xreg]
```

Also install PyTorch for your hardware (CUDA 12.1, CPU, or Apple Silicon MPS).

## Minimal example

```python
import torch, numpy as np, timesfm

torch.set_float32_matmul_precision("high")
model = timesfm.TimesFM_2p5_200M_torch.from_pretrained("google/timesfm-2.5-200m-pytorch")
model.compile(timesfm.ForecastConfig(
    max_context=1024,
    max_horizon=256,
    normalize_inputs=True,
    use_continuous_quantile_head=True,
    force_flip_invariance=True,
    infer_is_positive=True,
    fix_quantile_crossing=True,
))
point, quantiles = model.forecast(horizon=24, inputs=[np.sin(np.linspace(0, 20, 200))])
# point.shape == (1, 24)
# quantiles.shape == (1, 24, 10)
```

## Output semantics

- `point_forecast` = median (q0.5) — shape `(batch, horizon)`.
- `quantile_forecast` — shape `(batch, horizon, 10)`:
  - index 0 = mean
  - index 1 = q10
  - index 5 = q50 (median)
  - index 9 = q90

## Covariates (XReg)

```python
point, quantiles = model.forecast_with_covariates(
    inputs=inputs,
    dynamic_numerical_covariates={"price": price_arrays},
    dynamic_categorical_covariates={"holiday": holiday_arrays},
    static_categorical_covariates={"region": region_labels},
    xreg_mode="xreg + timesfm",
)
```

## Hermes integration

- Use this skill in `skills` field of a Hermes agent / Mosaic AI agent.
- Run `scripts/forecast_csv.py` from Hermes `terminal` for end-to-end CSV forecasting.
- Wrap frequent workflows as smaller Hermes skills or cron jobs.

## Pitfalls

- **Quantile index off-by-one**: index 0 is mean, not q0. Use `IDX_Q10, IDX_Q90 = 1, 9`.
- **Context length**: at least 32 data points.
- **Frequency flag**: only for v1/v2; TimesFM 2.5 removed it.
- **Headless plotting**: `import matplotlib; matplotlib.use("Agg")` before `pyplot`.
- **Negatives**: set `infer_is_positive=False` for temperature, returns, etc.

## Resources

- https://github.com/google-research/timesfm
- Paper: arXiv:2310.10688
- HuggingFace: https://huggingface.co/collections/google/timesfm-release-66e4be5fdb56e960c1e482a6

