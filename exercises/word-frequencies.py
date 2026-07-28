# %% [markdown]
# # Word frequencies from an empty file
#
# Read a text file, count words, return the top `n` sorted by frequency.
# Nothing here is new material. The check is whether you can assemble it
# without a template — and whether you handle the input that does not exist.

# %%
# Paste your token from Settings. It authorises this one endpoint and nothing
# else, so a shared notebook leaks nothing but the ability to record attempts.
TOKEN = ""
APP = "https://halflife.getravi.workers.dev"

# %%
def top_words(path, n=20):
    """Return a list of (word, count), most frequent first.

    Ties break alphabetically. Words are case-folded. A missing path raises
    rather than returning an empty list.
    """
    raise NotImplementedError


# %%
# ---- graded cell: run it, do not edit it ----
import os
import tempfile
import requests


def _write(text):
    fd, p = tempfile.mkstemp(suffix=".txt")
    with os.fdopen(fd, "w") as fh:
        fh.write(text)
    return p


def _grade():
    results = []

    sample = _write("the cat the dog THE bird a cat\n")

    try:
        out = top_words(sample, 3)
    except Exception as exc:
        print("top_words() raised:", exc)
        return [("runs at all", False)] * 5

    results.append(("returns a list of pairs",
                    isinstance(out, list) and all(len(x) == 2 for x in out)))
    results.append(("counts and orders by frequency", list(out[:1]) == [("the", 3)]))
    results.append(("case-folds", not any(w.isupper() for w, _ in out)))

    # cat=2, then the alphabetical tie among the ones. Sorting by count alone
    # leaves ties in dictionary order, which is not deterministic across runs.
    tie = top_words(_write("b b a a c\n"), 3)
    results.append(("breaks ties alphabetically", [w for w, _ in tie] == ["a", "b", "c"]))

    # The case the subtask is named after. An empty list here is the wrong
    # answer: it is indistinguishable from a file that exists and is empty.
    missing = "/tmp/definitely-not-here-9f3a2b.txt"
    try:
        top_words(missing, 3)
        raised = False
    except Exception:
        raised = True
    results.append(("raises on a missing path rather than returning []", raised))

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
        json={"exerciseId": "word-frequencies", "passed": _passed, "total": len(_r)},
    )
    print("submitted:", _resp.status_code, _resp.text[:200])
else:
    print("no TOKEN set - nothing was submitted")
