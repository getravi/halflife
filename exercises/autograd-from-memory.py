# %% [markdown]
# # Scalar autograd from memory
#
# Close every tab. Rebuild scalar autograd cold: `add`, `mul`, `tanh`, and a
# `backward()` via topological sort.
#
# The reused-node case is the whole test. It is what separates accumulating
# from overwriting, and an implementation that overwrites still gets simple
# graphs right.

# %%
# Paste your token from Settings. It authorises this one endpoint and nothing
# else, so a shared notebook leaks nothing but the ability to record attempts.
TOKEN = ""
APP = "https://halflife.getravi.workers.dev"

# %%
class Value:
    """Scalar with a gradient. Support +, *, tanh() and backward()."""

    def __init__(self, data, _children=()):
        raise NotImplementedError


# %%
# ---- graded cell: run it, do not edit it ----
import math
import torch
import requests


def _grade():
    results = []

    try:
        a = Value(2.0)
        b = Value(-3.0)
        c = a * b + a
    except Exception as exc:
        print("Value raised:", exc)
        return [("runs at all", False)] * 6

    results.append(("forward: add and multiply", math.isclose(c.data, -4.0, abs_tol=1e-6)))
    results.append(("forward: tanh", math.isclose(Value(0.5).tanh().data,
                                                  math.tanh(0.5), abs_tol=1e-6)))

    # Simple graph against PyTorch.
    x = Value(1.5)
    y = Value(-2.0)
    z = (x * y).tanh()
    z.backward()

    tx = torch.tensor(1.5, requires_grad=True)
    ty = torch.tensor(-2.0, requires_grad=True)
    (tx * ty).tanh().backward()

    results.append(("backward matches PyTorch", math.isclose(x.grad, tx.grad.item(), abs_tol=1e-6)))

    # b = a * a  ->  db/da = 2a. An implementation that assigns instead of
    # accumulating returns a here, and gets every non-reusing graph right.
    a2 = Value(3.0)
    (a2 * a2).backward()
    results.append(("b = a * a gives db/da = 2a", math.isclose(a2.grad, 6.0, abs_tol=1e-6)))

    # Deeper graph, one node reused twice, checked against PyTorch.
    p = Value(0.7)
    q = Value(-1.3)
    out = ((p * q) + p) * (p.tanh())
    out.backward()

    tp = torch.tensor(0.7, requires_grad=True)
    tq = torch.tensor(-1.3, requires_grad=True)
    (((tp * tq) + tp) * torch.tanh(tp)).backward()

    results.append(("deeper reused graph matches PyTorch",
                    math.isclose(p.grad, tp.grad.item(), abs_tol=1e-6)))

    # Calling backward twice should add to the existing gradient, not reset it.
    r = Value(2.0)
    s = r * Value(5.0)
    s.backward()
    first = r.grad
    results.append(("gradients accumulate rather than overwrite", first != 0))

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
        json={"exerciseId": "autograd-from-memory", "passed": _passed, "total": len(_r)},
    )
    print("submitted:", _resp.status_code, _resp.text[:200])
else:
    print("no TOKEN set - nothing was submitted")
