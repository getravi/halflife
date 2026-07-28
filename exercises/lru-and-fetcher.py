# %% [markdown]
# # Typed LRU cache and a concurrent fetcher
#
# Two pieces. A cache with a capacity and least-recently-used eviction, and a
# fetcher that runs work concurrently under a bound.
#
# The bound is the part that matters. Unbounded concurrency looks faster in a
# toy and takes down the thing you are calling.

# %%
# Paste your token from Settings. It authorises this one endpoint and nothing
# else, so a shared notebook leaks nothing but the ability to record attempts.
TOKEN = ""
APP = "https://halflife.getravi.workers.dev"

# %%
from typing import Callable, Iterable, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class LRU:
    """Capacity-bounded cache. get() counts as a use."""

    def __init__(self, capacity: int):
        raise NotImplementedError


async def fetch_all(items: Iterable, work: Callable, limit: int = 4) -> list:
    """Run work(item) for every item, at most `limit` at a time.

    Results come back in the order of `items`. A single failure must not sink
    the batch: return the exception in its slot.
    """
    raise NotImplementedError


# %%
# ---- graded cell: run it, do not edit it ----
import asyncio
import time
import requests


def _grade():
    results = []

    try:
        c = LRU(2)
        c.put("a", 1)
        c.put("b", 2)
    except Exception as exc:
        print("LRU raised:", exc)
        return [("runs at all", False)] * 6

    results.append(("stores and returns a value", c.get("a") == 1))

    # "a" was just read, so "b" is now least recently used.
    c.put("c", 3)
    results.append(("evicts at capacity", c.get("b") is None))
    results.append(("a get counts as a use", c.get("a") == 1))

    async def _slow(i):
        await asyncio.sleep(0.05)
        return i * 2

    started = time.perf_counter()
    out = asyncio.run(fetch_all(range(8), _slow, limit=4))
    elapsed = time.perf_counter() - started

    results.append(("returns results in input order", list(out) == [i * 2 for i in range(8)]))
    # Serial would be 0.40s; eight at once would be 0.05s. Four at a time is
    # two waves, so this brackets the bound from both sides.
    results.append(("runs concurrently, but no wider than the limit",
                    0.08 < elapsed < 0.25))

    async def _flaky(i):
        if i == 2:
            raise ValueError("boom")
        return i

    mixed = asyncio.run(fetch_all(range(4), _flaky, limit=2))
    results.append(("one failure does not sink the batch",
                    isinstance(mixed[2], Exception) and mixed[3] == 3))

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
        json={"exerciseId": "lru-and-fetcher", "passed": _passed, "total": len(_r)},
    )
    print("submitted:", _resp.status_code, _resp.text[:200])
else:
    print("no TOKEN set - nothing was submitted")
