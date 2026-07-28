# %% [markdown]
# # Attention in einsum
#
# Implement scaled dot-product attention with a causal mask, using only
# `np.einsum` and `np.exp`. It is checked against PyTorch to 1e-5.
#
# Passing requires that you can say aloud what every index letter denotes.
# Nothing here checks that, and it is still the point.

# %%
# Paste your token from Settings. It authorises this one endpoint and nothing
# else, so a shared notebook leaks nothing but the ability to record attempts.
TOKEN = ""
APP = "https://halflife.getravi.workers.dev"

# %%
import numpy as np


def attention(Q, K, V):
    """Q, K, V are (B, H, T, D). Return (B, H, T, D), causally masked."""
    raise NotImplementedError


# %%
# ---- graded cell: run it, do not edit it ----
import numpy as np
import torch
import requests


def _grade():
    results = []
    rng = np.random.default_rng(0)
    B, H, T, D = 2, 3, 5, 4
    q, k, v = (rng.standard_normal((B, H, T, D)).astype(np.float32) for _ in range(3))

    try:
        out = attention(q, k, v)
    except Exception as exc:
        print("attention() raised:", exc)
        return [("runs at all", False)] * 5

    results.append(("returns an ndarray", isinstance(out, np.ndarray)))
    results.append(("keeps the shape", getattr(out, "shape", None) == (B, H, T, D)))

    ref = torch.nn.functional.scaled_dot_product_attention(
        torch.tensor(q), torch.tensor(k), torch.tensor(v), is_causal=True
    ).numpy()
    results.append(("matches PyTorch to 1e-5", np.allclose(out, ref, atol=1e-5)))

    # Row 0 can only attend to position 0, so it must return v[..., 0, :]
    # exactly. This is the mask check that a sum-to-one test would miss.
    results.append(
        ("row 0 attends only to position 0", np.allclose(out[:, :, 0], v[:, :, 0], atol=1e-5))
    )

    # A stable softmax subtracts the row max. Without it this overflows.
    results.append(("stays finite on large inputs", bool(np.all(np.isfinite(attention(q * 50.0, k, v))))))
    return results


_r = _grade()
for _name, _ok in _r:
    print(("PASS  " if _ok else "FAIL  ") + _name)

_passed = sum(1 for _, _ok in _r if _ok)
print(f"\n{_passed}/{len(_r)}")

if TOKEN:
    _resp = requests.post(
        f"{APP}/api/attempts",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"exerciseId": "attention-einsum", "passed": _passed, "total": len(_r)},
    )
    print("submitted:", _resp.status_code, _resp.text[:200])
else:
    print("no TOKEN set - nothing was submitted")
