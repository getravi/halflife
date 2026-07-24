/**
 * resources_db.js
 * Enriched Learning Resources Database for the Frontier Lab Plan
 * Keyed by: Page Name -> Section ID (Checkbox data-id) -> Subtask Title
 * Last audited: 2026-07-24 (URLs liveness-checked; media attribution verified; prose updated to 2026)
 */

window.RESOURCES_DB = {
  "phase0.html": {
    "p0-python-basics": {
      "Set up and write your first programs": {
        "desc": "Get a working Python 3.13 toolchain on your machine and run code you wrote yourself, today. The goal is not elegance: it is removing every excuse between having an idea and seeing output in a terminal.",
        "steps": [
          "Install Python 3.13 from python.org (or let `uv python install 3.13` do it), then confirm with `python3 --version` in a fresh terminal.",
          "Install `uv` (Astral's installer/package manager) and create your first project with `uv init hello && cd hello && uv run main.py`.",
          "Write `hello.py` in a real editor (VS Code), save it, and run it from the terminal — not from a REPL. Repeat until the save-run loop is muscle memory.",
          "Learn variables and the core scalar types: `str`, `int`, `float`, `bool`. Practice `input()`, `print()`, and explicit conversion with `int()` / `float()`.",
          "Master f-strings: `f\"{name} scored {score:.2f}\"`. Use them for all string building; never reach for `+` concatenation or `%` formatting.",
          "Write three tiny programs from scratch: a temperature converter, a tip calculator, and a program that greets you by name and tells you the length of that name."
        ],
        "courses": [
          {
            "name": "Python for Everybody (Dr. Chuck, free full course)",
            "url": "https://www.py4e.com/lessons"
          },
          {
            "name": "Automate the Boring Stuff with Python, 3rd ed. — Ch. 1: Python Basics",
            "url": "https://automatetheboringstuff.com/3e/chapter1.html"
          },
          {
            "name": "CS50's Introduction to Programming with Python (Harvard, free)",
            "url": "https://cs50.harvard.edu/python/"
          }
        ],
        "docs": [
          {
            "name": "Python 3.13 downloads and installers",
            "url": "https://www.python.org/downloads/"
          },
          {
            "name": "uv — installation guide",
            "url": "https://docs.astral.sh/uv/getting-started/installation/"
          },
          {
            "name": "uv — running scripts",
            "url": "https://docs.astral.sh/uv/guides/scripts/"
          },
          {
            "name": "Official tutorial: An Informal Introduction to Python",
            "url": "https://docs.python.org/3/tutorial/introduction.html"
          },
          {
            "name": "Language reference: f-strings",
            "url": "https://docs.python.org/3/reference/lexical_analysis.html#f-strings"
          }
        ],
        "videos": [
          {
            "title": "Learn Python — Full Course for Beginners (freeCodeCamp)",
            "url": "https://www.youtube.com/watch?v=rfscVS0vtbw"
          },
          {
            "title": "uv: A Faster, All-in-One Package Manager to Replace Pip and Venv (Corey Schafer)",
            "url": "https://www.youtube.com/watch?v=AMdG7IjgSPM"
          },
          {
            "title": "Python Tutorial for Beginners 2: Strings — Working with Textual Data (Corey Schafer)",
            "url": "https://www.youtube.com/watch?v=k9TUPpGqYTo"
          }
        ]
      },
      "Data structures and control flow": {
        "desc": "Learn the four containers that carry nearly all Python data — list, dict, set, tuple — and the loops and conditionals that move data through them. Picking the right container is most of what makes beginner code fast or slow.",
        "steps": [
          "Learn `list`: append, index, slice (`xs[1:4]`, `xs[::-1]`), `len`, `sort` vs `sorted`. Slicing returns a new list — prove it to yourself.",
          "Learn `dict`: `d[k]`, `d.get(k, default)`, `d.items()`, and membership with `in`. This is the container you will use to count things.",
          "Learn `set` for deduplication and O(1) membership, and `tuple` for fixed-size records you do not intend to change.",
          "Drill mutability until it stops surprising you: pass a list into a function and mutate it; do the same with a tuple and a string and watch it fail. Understand why `a = b` does not copy.",
          "Write loops: `for x in xs`, `for i, x in enumerate(xs)`, `for k, v in d.items()`, plus `while`, `break`, `continue`. Prefer iterating over the object itself, not `range(len(xs))`.",
          "Rewrite three of your loops as comprehensions (`[f(x) for x in xs if p(x)]`) once — and only once — the loop version already works."
        ],
        "courses": [
          {
            "name": "Google's Python Class (setup-light, exercise-heavy)",
            "url": "https://developers.google.com/edu/python"
          },
          {
            "name": "Think Python, 3rd edition (Allen Downey, free online)",
            "url": "https://allendowney.github.io/ThinkPython/"
          },
          {
            "name": "Exercism Python track (mentored practice problems)",
            "url": "https://exercism.org/tracks/python"
          }
        ],
        "docs": [
          {
            "name": "Official tutorial: Data Structures (lists, dicts, sets, tuples)",
            "url": "https://docs.python.org/3/tutorial/datastructures.html"
          },
          {
            "name": "Official tutorial: More Control Flow Tools",
            "url": "https://docs.python.org/3/tutorial/controlflow.html"
          },
          {
            "name": "Sorting HOW TO (`key=`, `reverse=`, stability)",
            "url": "https://docs.python.org/3/howto/sorting.html"
          }
        ],
        "videos": [
          {
            "title": "Python Tutorial for Beginners 4: Lists, Tuples, and Sets (Corey Schafer)",
            "url": "https://www.youtube.com/watch?v=W8KRzm-HUcc"
          },
          {
            "title": "Python Programming Beginner Tutorials — full playlist (Corey Schafer)",
            "url": "https://www.youtube.com/playlist?list=PL-osiE80TeTskrapNbzXhwoFUiLCjGgY7"
          }
        ]
      },
      "Functions, files, errors, and classes": {
        "desc": "Move from scripts that run top-to-bottom to code organized into named, reusable pieces that touch the filesystem and survive bad input. This is the boundary between 'can write Python' and 'can build something'.",
        "steps": [
          "Write functions with positional args, default args, and an explicit `return`. Understand local vs global scope: a name assigned inside a function does not leak out.",
          "Read and write files with `with open(path, encoding=\"utf-8\") as f:`. Always use the `with` block so the file closes itself, and always pass `encoding`.",
          "Learn `try` / `except SpecificError` / `else` / `finally`. Catch `FileNotFoundError` and `ValueError` specifically — never write a bare `except:`.",
          "Learn to read a traceback bottom-up: the last line is the error type and message, the lines above it are the call chain. Deliberately break your own code five times and read each traceback out loud.",
          "Split one of your scripts into two files and `import` one from the other. Learn what `if __name__ == \"__main__\":` actually guards against.",
          "Write one small class with `__init__`, one or two methods, and a `__repr__`. Do not go further into inheritance yet — you do not need it."
        ],
        "courses": [
          {
            "name": "Automate the Boring Stuff with Python (functions, files, error handling)",
            "url": "https://automatetheboringstuff.com/"
          },
          {
            "name": "Python for Everybody — functions, files, and objects chapters",
            "url": "https://www.py4e.com/lessons"
          }
        ],
        "docs": [
          {
            "name": "Official tutorial: Defining Functions",
            "url": "https://docs.python.org/3/tutorial/controlflow.html"
          },
          {
            "name": "Official tutorial: Errors and Exceptions",
            "url": "https://docs.python.org/3/tutorial/errors.html"
          },
          {
            "name": "Official tutorial: Input and Output (reading/writing files)",
            "url": "https://docs.python.org/3/tutorial/inputoutput.html"
          },
          {
            "name": "Official tutorial: Modules and imports",
            "url": "https://docs.python.org/3/tutorial/modules.html"
          },
          {
            "name": "Official tutorial: Classes",
            "url": "https://docs.python.org/3/tutorial/classes.html"
          }
        ],
        "videos": [
          {
            "title": "Python Programming Beginner Tutorials — functions, files, error handling, OOP (Corey Schafer)",
            "url": "https://www.youtube.com/playlist?list=PL-osiE80TeTskrapNbzXhwoFUiLCjGgY7"
          },
          {
            "title": "Learn Python — Full Course for Beginners (freeCodeCamp)",
            "url": "https://www.youtube.com/watch?v=rfscVS0vtbw"
          }
        ]
      },
      "Exit check": {
        "desc": "Prove the phase is done by writing one complete, structured program from an empty file with no tutorial open. Word frequency counting is the smallest task that forces every skill above to show up at once.",
        "steps": [
          "Open an empty `wordfreq.py`. No tutorial, no copy-paste, no starter file. A search engine for stdlib syntax is allowed; a search for 'python word frequency' is not.",
          "Structure it as one function per step: `read_text(path)`, `count_words(text)`, `top_n(counts, n)`, `write_report(rows, out_path)`, plus a `main()` that wires them together.",
          "Read the input file with an explicit `encoding=\"utf-8\"`, lowercase it, and split on non-letters so `The` and `the,` count as the same word.",
          "Count with a `dict` you build by hand first; only then rewrite it with `collections.Counter` and confirm both give the same answer.",
          "Sort by count descending, break ties alphabetically, and write the top 20 as `word<TAB>count` lines to an output file.",
          "Handle a missing input file and an unreadable/empty file with a specific `except` and a clear message — no traceback dumped at the user.",
          "Success criteria: correct output on a book-length text (grab any plain-text novel), every step in its own function, graceful failure on a bad path, and the whole thing written in under an hour."
        ],
        "docs": [
          {
            "name": "`collections.Counter` (and `most_common`)",
            "url": "https://docs.python.org/3/library/collections.html#collections.Counter"
          },
          {
            "name": "Sorting HOW TO — sorting by multiple keys",
            "url": "https://docs.python.org/3/howto/sorting.html"
          },
          {
            "name": "Built-in exceptions (which one to catch)",
            "url": "https://docs.python.org/3/library/exceptions.html"
          },
          {
            "name": "`traceback` module — reading and printing tracebacks",
            "url": "https://docs.python.org/3/library/traceback.html"
          }
        ],
        "courses": [
          {
            "name": "Exercism Python track — practice problems to repeat the drill",
            "url": "https://exercism.org/tracks/python"
          }
        ]
      }
    },
    "p0-python-fluency": {
      "Refresh core Python": {
        "desc": "Move from writing Python that works to writing Python that reads well. Coming out of Task 01 you can already solve problems; this is where the idiomatic patterns become automatic, so you stop reaching for a search engine on basic syntax.",
        "steps": [
          "Review list, dict, and set comprehensions. Practice building complex nested filters.",
          "Master generators, generator expressions, and memory-efficient streaming of large files.",
          "Deep dive into function decorators, context managers (`__enter__`/`__exit__` and `contextlib`), and variable argument passing (`*args`, `**kwargs`).",
          "Practice writing classes with magic methods (`__init__`, `__str__`, `__repr__`, `__getitem__`, `__setitem__`, `__call__`)."
        ],
        "courses": [
          {
            "name": "Python 3 Deep Dive (Fred Baptiste / Udemy)",
            "url": "https://docs.python.org/3/reference/datamodel.html"
          },
          {
            "name": "Free alternative: Python Docs HOWTOs - Advanced Python Topics",
            "url": "https://docs.python.org/3/howto/index.html"
          },
          {
            "name": "Free alternative: freeCodeCamp Learn Python - Full Course for Beginners",
            "url": "https://www.youtube.com/watch?v=rfscVS0vtbw"
          },
          {
            "name": "Intermediate Python (free online book by Muhammad Yasoob Ullah Khalid)",
            "url": "https://book.pythontips.com/en/latest/"
          },
          {
            "name": "Free alternative: Automate the Boring Stuff with Python",
            "url": "https://automatetheboringstuff.com/"
          }
        ],
        "papers": [
          {
            "name": "PEP 8 – Style Guide for Python Code",
            "url": "https://peps.python.org/pep-0008/"
          },
          {
            "name": "PEP 343 – The 'with' Statement",
            "url": "https://peps.python.org/pep-0343/"
          }
        ],
        "lectures": [
          {
            "name": "Official Python Tutorial: Core Features & Idioms",
            "url": "https://docs.python.org/3/tutorial/index.html"
          },
          {
            "name": "Python Advanced Flow Control Lecture Notes",
            "url": "https://docs.python.org/3/howto/index.html"
          }
        ],
        "docs": [
          {
            "name": "Python Contextlib Standard Library Docs",
            "url": "https://docs.python.org/3/library/contextlib.html"
          }
        ],
        "videos": [
          {
            "title": "Python Tutorial: Decorators (Corey Schafer)",
            "url": "https://www.youtube.com/watch?v=FsAPt_9Bf3U"
          },
          {
            "title": "Context Managers and the 'with' statement (mCoding)",
            "url": "https://www.youtube.com/watch?v=LBJlGwJ899Y"
          }
        ],
        "podcasts": [
          {
            "title": "Talk Python To Me #141: Python Tricks (Michael Kennedy with Dan Bader)",
            "url": "https://talkpython.fm/episodes/show/141/python-tricks"
          }
        ]
      },
      "Type annotations & tooling": {
        "desc": "Set up a modern, clean, and strictly typed development environment. Static typing and fast linting make larger ML and eval codebases easier to review.",
        "steps": [
          "Study type annotations using the modern spellings: built-in generics (`list[str]`, `dict[str, int]`, `tuple[int, ...]`), `X | None` instead of `Optional`, `X | Y` instead of `Union`, plus `Callable` and generics. The old `typing.List`/`Dict`/`Tuple` forms are legacy and not what you should be writing.",
          "Configure VS Code or your editor of choice with the Python extension, Ruff 0.16 (for linting/formatting), and mypy 2.x (for type checking). Astral's `ty` and Meta's `pyrefly` are worth watching, but mypy is still the default you should learn on.",
          "Set up strict Mypy settings: `disallow_untyped_defs = True` and `warn_unused_ignores = True`.",
          "Learn to fix common type errors (e.g., handling optional values, casting, overloads)."
        ],
        "courses": [
          {
            "name": "Type Hints Cheat Sheet (official mypy documentation, mypy 2.x)",
            "url": "https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html"
          },
          {
            "name": "Free alternative: Python Typing Documentation",
            "url": "https://docs.python.org/3/library/typing.html"
          }
        ],
        "papers": [
          {
            "name": "PEP 484 – Type Hints",
            "url": "https://peps.python.org/pep-0484/"
          },
          {
            "name": "PEP 526 – Syntax for Variable Annotations",
            "url": "https://peps.python.org/pep-0526/"
          }
        ],
        "lectures": [
          {
            "name": "Mypy Type Checker Official Docs Reference",
            "url": "https://mypy.readthedocs.io/en/stable/index.html"
          }
        ],
        "docs": [
          {
            "name": "Ruff Linter & Formatter Configuration Guides",
            "url": "https://docs.astral.sh/ruff/"
          }
        ],
        "videos": [
          {
            "title": "Type Checking in Python with Mypy (mCoding)",
            "url": "https://www.youtube.com/watch?v=mvJuxowIwIc"
          }
        ],
        "podcasts": [
          {
            "title": "Talk Python To Me #400: Ruff - The Fast, Rust-based Python Linter (with Charlie Marsh, Astral)",
            "url": "https://talkpython.fm/episodes/show/400/ruff-the-fast-rust-based-python-linter"
          }
        ]
      },
      "Exit check": {
        "desc": "Verify your speed, accuracy, and typing discipline with a standard systems-programming task under time constraints.",
        "steps": [
          "Write a generic Least Recently Used (LRU) Cache from scratch without looking up implementations.",
          "Use a combination of a Doubly Linked List (for order tracking) and a Hash Map (for constant time lookup).",
          "Ensure your code is fully type-annotated and passes strict Mypy checks.",
          "Verify that both get() and put() operations run in O(1) time complexity. Complete within 30 minutes."
        ],
        "courses": [
          {
            "name": "Algorithms and Data Structures (MIT 6.006)",
            "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/"
          }
        ],
        "papers": [
          {
            "name": "Least Recently Used Cache Replacement Algorithms",
            "url": "https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU"
          }
        ],
        "lectures": [
          {
            "name": "CS 61B Lecture Notes on Hash Maps and Linked Lists",
            "url": "https://sp26.datastructur.es/"
          }
        ],
        "docs": [],
        "videos": [
          {
            "title": "LeetCode 146 - LRU Cache Explanation (NeetCode)",
            "url": "https://www.youtube.com/watch?v=7ABFKPK2hD4"
          }
        ]
      }
    },
    "p0-numpy": {
      "Think in arrays, not loops": {
        "desc": "Transition from procedural loops to vectorized execution. Vectorization runs loops in C/C++ inside NumPy's internals, avoiding Python interpreter overhead.",
        "steps": [
          "Work through the NumPy 100 exercises. Focus on array creation, reshaping, slicing, and index manipulation.",
          "Master Broadcasting rules: how NumPy handles arithmetic operations on arrays of different shapes.",
          "Learn Fancy Indexing and Boolean Masks. Avoid iterating over arrays at all costs.",
          "Master `np.einsum` (Einstein summation notation) for compact, optimized matrix operations."
        ],
        "courses": [
          {
            "name": "NumPy Quickstart (official NumPy documentation, NumPy developers)",
            "url": "https://numpy.org/doc/stable/user/quickstart.html"
          },
          {
            "name": "Free alternative: NumPy Absolute Beginners Tutorial",
            "url": "https://numpy.org/doc/stable/user/absolute_beginners.html"
          }
        ],
        "papers": [
          {
            "name": "The NumPy Array: A Structure for Efficient Numerical Computation (Walt et al.)",
            "url": "https://arxiv.org/abs/1102.1523"
          }
        ],
        "lectures": [
          {
            "name": "Advanced NumPy Lectures (SciPy Conference)",
            "url": "https://lectures.scientific-python.org/intro/numpy/index.html"
          }
        ],
        "docs": [
          {
            "name": "Broadcasting Visual Guide (Jay Alammar)",
            "url": "https://jalammar.github.io/visual-numpy/"
          },
          {
            "name": "Einsum Tutorial & Cheat Sheet",
            "url": "https://ajcr.net/Basic-guide-to-einsum/"
          },
          {
            "name": "NumPy 100 Exercises GitHub",
            "url": "https://github.com/rougier/numpy-100"
          }
        ],
        "videos": [
          {
            "title": "Einsum Is All You Need: NumPy, PyTorch and TensorFlow (Aladdin Persson)",
            "url": "https://www.youtube.com/watch?v=pkVwUVEHmfI"
          }
        ]
      },
      "Matrix ops by hand": {
        "desc": "Implement core neural network mathematical blocks using only NumPy to understand vectorization mechanics.",
        "steps": [
          "Write matrix multiplication (`dot` product and transpose) manually in NumPy and compare runtime with native lists.",
          "Implement the Softmax function. Pay close attention to numerical stability (subtract the max value from inputs to prevent overflow).",
          "Implement Layer Normalization (computes mean and variance over the last axis) with scale and shift parameters."
        ],
        "courses": [
          {
            "name": "Mathematics for Machine Learning (Imperial College London)",
            "url": "https://www.coursera.org/specializations/mathematics-machine-learning"
          },
          {
            "name": "Free alternative: Mathematics for Machine Learning Book",
            "url": "https://mml-book.github.io/"
          }
        ],
        "papers": [
          {
            "name": "Layer Normalization (Ba, Kiros, Hinton)",
            "url": "https://arxiv.org/abs/1607.06450"
          }
        ],
        "lectures": [
          {
            "name": "Numerical Stability of Softmax (Eli Bendersky)",
            "url": "https://eli.thegreenplace.net/2016/the-softmax-function-and-its-derivative/"
          }
        ],
        "docs": [],
        "videos": [
          {
            "title": "torch.nn.LayerNorm Explained (Machine Learning with PyTorch)",
            "url": "https://www.youtube.com/watch?v=MbJqGUetg7A"
          }
        ]
      },
      "Exit check": {
        "desc": "Prove your vectorization efficiency by building the core mathematical block of transformers.",
        "steps": [
          "Implement Scaled Dot-Product Attention: Q, K, V -> output.",
          "Use only `np.einsum` for multi-dimensional matrix multiplications and `np.exp` / `np.sum` for stabilized softmax.",
          "Ensure your code has zero Python for-loops.",
          "Verify your calculations match a PyTorch reference implementation up to 1e-5 numerical tolerance."
        ],
        "courses": [
          {
            "name": "Stanford CS224N: Natural Language Processing",
            "url": "https://web.stanford.edu/class/cs224n/"
          }
        ],
        "papers": [
          {
            "name": "Attention Is All You Need (Vaswani et al.)",
            "url": "https://arxiv.org/abs/1706.03762"
          }
        ],
        "lectures": [
          {
            "name": "Attention Is All You Need Math Recap (Dive Into Deep Learning)",
            "url": "https://d2l.ai/chapter_attention-mechanisms-and-transformers/queries-keys-values.html"
          }
        ],
        "docs": [],
        "videos": [
          {
            "title": "SCALED Dot-Product Attention Explained (Skill Advancement)",
            "url": "https://www.youtube.com/watch?v=c4vxarctsdA"
          }
        ]
      }
    },
    "p0-algorithms": {
      "Complexity intuition": {
        "desc": "Rebuild the mental reflex of identifying time and space complexity of code blocks to write scalable systems.",
        "steps": [
          "Study asymptotic notations (Big O, Theta, Omega). Know the mathematical definitions.",
          "Understand how arrays, hash tables, and binary trees allocate memory.",
          "Analyze algorithmic patterns: Two-pointers, sliding window, binary search, BFS/DFS tree traversals.",
          "Master space complexity evaluation: stack memory during recursion vs heap allocation."
        ],
        "courses": [
          {
            "name": "Introduction to Algorithms (MIT 6.006)",
            "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/"
          }
        ],
        "papers": [],
        "lectures": [
          {
            "name": "Algorithmic Complexity Lectures (Stanford)",
            "url": "https://web.stanford.edu/class/cs161/"
          }
        ],
        "docs": [
          {
            "name": "Big O Cheat Sheet Reference",
            "url": "https://www.bigocheatsheet.com/"
          },
          {
            "name": "Algorithmic Complexity Visualizations (VisuAlgo)",
            "url": "https://visualgo.net/en"
          }
        ],
        "videos": [
          {
            "title": "Big O Notations (Derek Banas)",
            "url": "https://www.youtube.com/watch?v=V6mKVRU1evU"
          },
          {
            "title": "SOLVING ALL Sliding Window [Blind75 List] (Code with Carter)",
            "url": "https://www.youtube.com/watch?v=Mf9C6vDxhzk"
          }
        ]
      },
      "Optimizer math & 5 LeetCode": {
        "desc": "Implement gradient descent variants from scratch to build intuition for the optimizers you'll use in every training loop. 5 LeetCode Mediums for baseline debugging confidence — stop there.",
        "steps": [
          "Derive the SGD update rule from first principles: w = w - lr * grad.",
          "Implement SGD with momentum in NumPy: track velocity term v = momentum * v - lr * grad.",
          "Derive the Adam update rule on paper: biased first/second moment estimates, bias correction, epsilon stability term.",
          "Implement Adam in NumPy. Verify it matches torch.optim.Adam output on a test quadratic loss surface.",
          "Solve 5 LeetCode Medium problems (Two Sum, Group Anagrams, Binary Tree Level Order, Longest Common Subsequence, Number of Islands). Under 25 min each. Stop — do not expand this."
        ],
        "courses": [],
        "papers": [
          {
            "name": "Adam: A Method for Stochastic Optimization (Kingma, Ba)",
            "url": "https://arxiv.org/abs/1412.6980"
          }
        ],
        "lectures": [
          {
            "name": "CS231n Lecture 7: Training Neural Networks II (Optimizers)",
            "url": "https://cs231n.github.io/neural-networks-3/"
          }
        ],
        "docs": [
          {
            "name": "An Overview of Gradient Descent Optimization Algorithms (Ruder)",
            "url": "https://ruder.io/optimizing-gradient-descent/"
          }
        ],
        "videos": [
          {
            "title": "Gradient Descent, How Neural Networks Learn (3Blue1Brown)",
            "url": "https://www.youtube.com/watch?v=IHZwWFHWa-w"
          }
        ]
      }
    },
    "p0-git-tooling": {
      "Git fluency": {
        "desc": "Collaborate at scale in engineering teams by mastering advanced git workflows.",
        "steps": [
          "Learn interactive rebasing (`git rebase -i HEAD~N`) to squash, rename, and edit commits.",
          "Understand `git cherry-pick` and `git stash` (with push/pop/apply).",
          "Master `git bisect` to locate regression bugs in historical commits.",
          "Understand git worktrees to work on multiple branches simultaneously without stash conflicts."
        ],
        "courses": [
          {
            "name": "Version Control with Git (Udacity)",
            "url": "https://www.udacity.com/course/version-control-with-git--ud123"
          },
          {
            "name": "Free alternative: Pro Git Book",
            "url": "https://git-scm.com/book/en/v2"
          }
        ],
        "papers": [],
        "lectures": [
          {
            "name": "The Missing Semester of Your CS Education: Git (MIT)",
            "url": "https://missing.csail.mit.edu/2020/version-control/"
          }
        ],
        "docs": [
          {
            "name": "Git Immersion Exercises",
            "url": "https://gitimmersion.com/"
          },
          {
            "name": "Interactive Git Branching Tutorial",
            "url": "https://learngitbranching.js.org/"
          }
        ],
        "videos": [
          {
            "title": "Interactive Rebase Tutorial (GitKraken)",
            "url": "https://www.youtube.com/watch?v=JkpYvXdbnfQ"
          }
        ]
      },
      "Workspace setup with 'uv'": {
        "desc": "Set up a highly efficient environment using `uv` (0.11.x), Astral's Python package manager, which replaces slow conda/poetry/pip loops.",
        "steps": [
          "Install `uv`, use it to install Python 3.13, and initialize a python virtual environment.",
          "Learn to add dependencies, lock environments, and run script environments using `uv run`.",
          "Set up Jupyter notebooks inside VS Code to run in the `uv` environment."
        ],
        "courses": [],
        "papers": [],
        "lectures": [
          {
            "name": "Python Environment Best Practices (Astral Blog)",
            "url": "https://astral.sh/blog"
          }
        ],
        "docs": [
          {
            "name": "Astral UV Official Guide & Commands Reference",
            "url": "https://docs.astral.sh/uv/"
          }
        ],
        "videos": [
          {
            "title": "Why UV is Replacing Conda and Pip",
            "url": "https://www.youtube.com/watch?v=-O7082lqD5g"
          }
        ],
        "podcasts": [
          {
            "title": "Python Bytes: UV is redefining Python environments",
            "url": "https://pythonbytes.fm/episodes/show/372/uv-redefining-python-environments"
          }
        ]
      },
      "Profiling scripts": {
        "desc": "Learn to locate slow lines of code. System performance requires identifying the actual physical bottleneck, not guessing.",
        "steps": [
          "Profile a python script using standard library `cProfile` and save outputs.",
          "Use `line_profiler` to inspect code execution line-by-line.",
          "Use `memory_profiler` to track heap usage overtime.",
          "Learn to interpret profiling flamegraphs and optimize bottlenecks."
        ],
        "courses": [],
        "papers": [],
        "lectures": [
          {
            "name": "Performance Profiling Slides (Stanford)",
            "url": "https://web.stanford.edu/class/cs107/"
          }
        ],
        "docs": [
          {
            "name": "Optimizing Code: timeit, cProfile & line_profiler (Scientific Python Lectures)",
            "url": "https://lectures.scientific-python.org/advanced/optimizing/index.html"
          },
          {
            "name": "Free alternative: Python Profilers Documentation",
            "url": "https://docs.python.org/3/library/profile.html"
          },
          {
            "name": "Line Profiler Repository",
            "url": "https://github.com/pyutils/line_profiler"
          }
        ],
        "videos": [
          {
            "title": "Python Performance Profiling (mCoding)",
            "url": "https://www.youtube.com/watch?v=m_a0fN48Alw"
          }
        ]
      }
    },
    "p0-math-refresh": {
      "Linear algebra warmup": {
        "desc": "Review key vector and matrix operations that power weight reductions, projections, and parameter adaptations.",
        "steps": [
          "Understand Eigendecomposition and Singular Value Decomposition (SVD) mathematically.",
          "Review matrix rank and orthogonal projections.",
          "Work through 10 pencil-and-paper problems solving projections and matrix decompositions.",
          "Understand the connection between low-rank projection and LoRA layers."
        ],
        "courses": [
          {
            "name": "Linear Algebra (MIT 18.06)",
            "url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/"
          }
        ],
        "papers": [
          {
            "name": "Singular Value Decomposition and Principal Component Analysis",
            "url": "https://arxiv.org/abs/1404.1100"
          }
        ],
        "lectures": [
          {
            "name": "3Blue1Brown Linear Algebra Series Lecture Notes",
            "url": "https://www.3blue1brown.com/?topic=linear-algebra"
          }
        ],
        "docs": [
          {
            "name": "Introduction to SVD (Immersive Linear Algebra)",
            "url": "https://immersivemath.com/ila/index.html"
          }
        ],
        "videos": [
          {
            "title": "Singular Value Decomposition (Steve Brunton)",
            "url": "https://www.youtube.com/watch?v=gXbThCXjZFM"
          }
        ]
      },
      "Calculus & MLP Backprop": {
        "desc": "Solidify your understanding of autodiff by deriving network updates by hand.",
        "steps": [
          "Review the chain rule in vector form. Study Jacobians and Hessians.",
          "Derive backpropagation equations for a 2-layer Multi-Layer Perceptron (MLP) on paper.",
          "Implement the derived gradients in raw NumPy.",
          "Write a finite difference checker to numerically verify that your analytical gradients are correct to 1e-6."
        ],
        "courses": [
          {
            "name": "Multivariable Calculus (MIT 18.02)",
            "url": "https://ocw.mit.edu/courses/18-02-multivariable-calculus-fall-2007/"
          }
        ],
        "papers": [
          {
            "name": "Learning representations by back-propagating errors (Rumelhart, Hinton, Williams)",
            "url": "https://www.cs.toronto.edu/~hinton/absps/naturebp.pdf"
          }
        ],
        "lectures": [
          {
            "name": "Stanford CS231n Backpropagation Math Notes",
            "url": "https://cs231n.github.io/optimization-2/"
          }
        ],
        "docs": [
          {
            "name": "Calculus Visual Guides (3Blue1Brown)",
            "url": "https://www.3blue1brown.com/?topic=calculus"
          }
        ],
        "videos": [
          {
            "title": "The Calculus of Backpropagation (3Blue1Brown)",
            "url": "https://www.youtube.com/watch?v=tIeHLnjs5U8"
          }
        ]
      },
      "Probability & Entropy": {
        "desc": "Understand the information-theoretic frameworks that justify language model loss functions.",
        "steps": [
          "Define cross-entropy, Shannon entropy, and Kullback-Leibler (KL) divergence.",
          "Derive the gradient of the Softmax activation with respect to its inputs on paper.",
          "Explain why cross-entropy is the natural optimization target for categorical probability estimation."
        ],
        "courses": [
          {
            "name": "Probability & Statistics (Khan Academy)",
            "url": "https://www.khanacademy.org/math/statistics-probability"
          }
        ],
        "papers": [
          {
            "name": "A Mathematical Theory of Communication (Claude Shannon)",
            "url": "https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf"
          }
        ],
        "lectures": [
          {
            "name": "Information Theory and Entropy Slides (MIT)",
            "url": "https://ocw.mit.edu/courses/6-050j-information-and-entropy-spring-2008/"
          }
        ],
        "docs": [
          {
            "name": "Softmax Gradient Derivation (Eli Bendersky's blog)",
            "url": "https://eli.thegreenplace.net/2016/the-softmax-function-and-its-derivative/"
          }
        ],
        "videos": [
          {
            "title": "Entropy & Cross-Entropy Intuition (Aurélien Géron)",
            "url": "https://www.youtube.com/watch?v=ErfnhcEV1O8"
          }
        ]
      }
    }
  },
  "phase1.html": {
    "p1-karpathy-hero": {
      "Build Micrograd": {
        "desc": "Build a scalar-level autograd engine to understand backpropagation at its most fundamental level.",
        "steps": [
          "Watch Andrej Karpathy's Micrograd video lecture.",
          "Write a Value class that tracks arithmetic operations and dynamically builds a computational directed acyclic graph (DAG).",
          "Implement backward passes for additions, multiplications, powers, and activations (tanh/ReLU).",
          "Train a small Multi-Layer Perceptron on a 2D classification dataset."
        ],
        "courses": [
          {
            "name": "Neural Networks: Zero to Hero (Andrej Karpathy)",
            "url": "https://karpathy.ai/zero-to-hero.html"
          }
        ],
        "papers": [
          {
            "name": "Automatic Differentiation in Machine Learning: A Survey",
            "url": "https://arxiv.org/abs/1502.05767"
          }
        ],
        "lectures": [
          {
            "name": "Stanford CS231n Lecture 4: Backpropagation",
            "url": "https://cs231n.stanford.edu/slides/2026/lecture_4.pdf"
          }
        ],
        "docs": [
          {
            "name": "Micrograd GitHub Repository",
            "url": "https://github.com/karpathy/micrograd"
          }
        ],
        "videos": [
          {
            "title": "Build Micrograd from Scratch (Andrej Karpathy)",
            "url": "https://www.youtube.com/watch?v=VMj-3S1tku0"
          }
        ],
        "podcasts": [
          {
            "title": "Andrej Karpathy: Lex Fridman Podcast (Deep Learning discussion)",
            "url": "https://lexfridman.com/andrej-karpathy/"
          }
        ]
      },
      "Makemore Series": {
        "desc": "Walk through the evolution of language modeling architectures from simple character-level bigrams to deep neural networks.",
        "steps": [
          "Build a character-level bigram model. Implement training, count tables, and sampling.",
          "Implement the MLP language model (based on Bengio et al. 2003).",
          "Deep dive into initialization and batch normalization layers. Learn to diagnose dead neurons.",
          "Build an RNN and CNN model. Plot activations, weights, and gradient distributions during training."
        ],
        "courses": [
          {
            "name": "Deep Learning Specialization (Andrew Ng / Coursera)",
            "url": "https://www.coursera.org/specializations/deep-learning"
          },
          {
            "name": "Free alternative: Practical Deep Learning for Coders (fast.ai)",
            "url": "https://course.fast.ai/"
          }
        ],
        "papers": [
          {
            "name": "A Neural Probabilistic Language Model (Bengio et al.)",
            "url": "https://www.jmlr.org/papers/volume3/bengio03a/bengio03a.pdf"
          }
        ],
        "lectures": [
          {
            "name": "Stanford CS224N Lecture 2: Neural Classifiers & Backpropagation",
            "url": "https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture03-neuralnets.pdf"
          }
        ],
        "docs": [
          {
            "name": "Makemore GitHub Repository",
            "url": "https://github.com/karpathy/makemore"
          }
        ],
        "videos": [
          {
            "title": "Makemore MLP Language Model (Andrej Karpathy)",
            "url": "https://www.youtube.com/watch?v=TCH_1BHY58I"
          },
          {
            "title": "Makemore Activations & Batchnorm (Andrej Karpathy)",
            "url": "https://www.youtube.com/watch?v=P6sfmUTpUmc"
          }
        ]
      }
    },
    "p1-transformer-pytorch": {
      "Read Attention Paper": {
        "desc": "Read the foundational transformer paper that changed all sequence modeling in AI.",
        "steps": [
          "Read 'Attention Is All You Need' carefully.",
          "Study the diagram of the transformer encoder-decoder blocks.",
          "Deconstruct Multi-Head Attention math: why scale by the square root of the head dimension ($1/\\sqrt{d_k}$)?",
          "Analyze the positional encoding logic (sin/cos arrays)."
        ],
        "courses": [
          {
            "name": "Natural Language Processing (Stanford CS224N)",
            "url": "https://web.stanford.edu/class/cs224n/"
          }
        ],
        "papers": [
          {
            "name": "Attention Is All You Need (Vaswani et al.)",
            "url": "https://arxiv.org/abs/1706.03762"
          }
        ],
        "lectures": [
          {
            "name": "Stanford CS224N Lecture 5: Transformers",
            "url": "https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture05-transformers.pdf"
          }
        ],
        "docs": [
          {
            "name": "The Illustrated Transformer (Jay Alammar)",
            "url": "https://jalammar.github.io/illustrated-transformer/"
          },
          {
            "name": "The Annotated Transformer (Harvard NLP)",
            "url": "https://nlp.seas.harvard.edu/annotated-transformer/"
          }
        ],
        "videos": [
          {
            "title": "LSTM is dead. Long Live Transformers! (Seattle Applied Deep Learning)",
            "url": "https://www.youtube.com/watch?v=S27pHKBEp30"
          }
        ]
      },
      "Build a decoder-only transformer": {
        "desc": "Write a ~10M-parameter decoder-only transformer from an empty file in PyTorch 2.13 — embeddings, causal self-attention, MLP, residual stream, training loop, sampling. You have seen this shape in makemore; now build the full block stack yourself and train it to produce coherent text.",
        "steps": [
          "Budget the parameters first. Pick `n_layer`, `n_head`, `n_embd`, and vocab size so the total lands near 10M, and verify with `sum(p.numel() for p in model.parameters())` before you train anything.",
          "Implement causal self-attention by hand: Q/K/V projections, reshape into heads, scaled dot product, causal mask, softmax, output projection. Only after it matches, swap in `F.scaled_dot_product_attention` and check the loss curve is unchanged.",
          "Assemble the block as pre-norm residuals: `x = x + attn(norm(x))`, `x = x + mlp(norm(x))`. Pre-norm is why deep stacks train without warmup gymnastics — read the Xiong et al. paper for why.",
          "Add modern defaults and know what each one buys you: RMSNorm instead of LayerNorm, rotary position embeddings instead of learned positions, SwiGLU instead of plain GELU MLP.",
          "Write the training loop: AdamW, cosine schedule with warmup, gradient clipping, bf16 autocast, and a held-out validation loss you actually plot. Log tokens/sec so you notice when you make things slower.",
          "Sample from it with temperature and top-k, on a small corpus (TinyStories or Shakespeare). Overfit a single batch to near-zero loss first — if you cannot, the bug is in your model, not your data.",
          "Only after yours works, read `karpathy/nanoGPT`'s `model.py` and diff it against yours. Read it, do not run it: the author formally deprecated the repo in Nov 2025 in favour of nanochat."
        ],
        "papers": [
          {
            "name": "Attention Is All You Need (Vaswani et al., 2017)",
            "url": "https://arxiv.org/abs/1706.03762"
          },
          {
            "name": "Language Models are Unsupervised Multitask Learners (GPT-2, Radford et al.)",
            "url": "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf"
          },
          {
            "name": "On Layer Normalization in the Transformer Architecture (pre-LN, Xiong et al.)",
            "url": "https://arxiv.org/abs/2002.04745"
          },
          {
            "name": "RoFormer: Rotary Position Embedding (Su et al.)",
            "url": "https://arxiv.org/abs/2104.09864"
          },
          {
            "name": "GLU Variants Improve Transformer (SwiGLU, Shazeer)",
            "url": "https://arxiv.org/abs/2002.05202"
          }
        ],
        "docs": [
          {
            "name": "karpathy/nanoGPT `model.py` — reference reading only (repo deprecated Nov 2025)",
            "url": "https://github.com/karpathy/nanoGPT/blob/master/model.py"
          },
          {
            "name": "`F.scaled_dot_product_attention` (fused/flash backends)",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html"
          },
          {
            "name": "`torch.nn.RMSNorm`",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.RMSNorm.html"
          },
          {
            "name": "PyTorch automatic mixed precision examples (bf16 autocast + GradScaler)",
            "url": "https://docs.pytorch.org/docs/stable/notes/amp_examples.html"
          },
          {
            "name": "The Annotated Transformer (Harvard NLP)",
            "url": "https://nlp.seas.harvard.edu/annotated-transformer/"
          }
        ],
        "videos": [
          {
            "title": "Let's build GPT: from scratch, in code, spelled out (Karpathy)",
            "url": "https://www.youtube.com/watch?v=kCc8FmEb1nY"
          },
          {
            "title": "Let's reproduce GPT-2 (124M) (Karpathy)",
            "url": "https://www.youtube.com/watch?v=l8pRSuU81PU"
          }
        ],
        "lectures": [
          {
            "name": "The Illustrated Transformer (Jay Alammar)",
            "url": "https://jalammar.github.io/illustrated-transformer/"
          },
          {
            "name": "Self-attention from scratch, step by step (Sebastian Raschka)",
            "url": "https://sebastianraschka.com/blog/2023/self-attention-from-scratch.html"
          },
          {
            "name": "A Recipe for Training Neural Networks (Karpathy) — debug your training loop with this",
            "url": "https://karpathy.github.io/2019/04/25/recipe/"
          }
        ]
      },
      "Modern LLM internals": {
        "desc": "Understand the architectural changes that separate vanilla transformers from actual production LLMs. These come up in every serious frontier lab interview.",
        "steps": [
          "Read FlashAttention (Dao et al. 2022): understand IO-aware tiling — attention is memory-bandwidth-bound, not compute-bound. Why tiling the attention matrix in SRAM changes peak memory from O(n²) to O(n).",
          "Implement a minimal RoPE (Rotary Position Embedding): understand why learned sin/cos absolute encodings were replaced, and how relative position information is injected via rotation matrices.",
          "Read the GQA paper: understand how Grouped Query Attention reduces KV-cache memory vs multi-head and multi-query variants. Know the tradeoff between expressivity and memory.",
          "Trace KV-cache mechanics manually: what token vectors are cached, at what layer, when the cache is invalidated during generation. Measure cache size in bytes for a 7B model.",
          "Verify: can you explain each in a 5-minute whiteboard session without notes?"
        ],
        "courses": [],
        "papers": [
          {
            "name": "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness (Dao et al.)",
            "url": "https://arxiv.org/abs/2205.14135"
          },
          {
            "name": "RoFormer: Enhanced Transformer with Rotary Position Embedding (Su et al.)",
            "url": "https://arxiv.org/abs/2104.09864"
          },
          {
            "name": "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints (Ainslie et al.)",
            "url": "https://arxiv.org/abs/2305.13245"
          }
        ],
        "lectures": [
          {
            "name": "Lilian Weng: The Transformer Family v2 (attention mechanisms survey)",
            "url": "https://lilianweng.github.io/posts/2023-01-27-the-transformer-family-v2/"
          }
        ],
        "docs": [
          {
            "name": "FlashAttention GitHub",
            "url": "https://github.com/Dao-AILab/flash-attention"
          },
          {
            "name": "KV-cache explainer (Hugging Face Blog)",
            "url": "https://huggingface.co/blog/kv-cache-quantization"
          }
        ],
        "videos": [
          {
            "title": "FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision (Tri Dao)",
            "url": "https://tridao.me/blog/2024/flash3/"
          }
        ]
      }
    },
    "p1-cs336-basics": {
      "Watch the lectures": {
        "desc": "CS336 'Language Modeling from Scratch' is the only course that walks the entire stack — tokenization, architecture, kernels, parallelism, scaling laws, data, inference — with no library doing the interesting part for you. Watch it as the map for everything else in this phase.",
        "steps": [
          "Start from the course root at cs336.stanford.edu for the current (Spring 2026) syllabus, readings, and assignment schedule. Do not bookmark a `/spring2026` path — it 404s; the root redirects to the live iteration.",
          "Work the Spring 2026 lecture playlist on Stanford Online in order. Lectures 1-4 (overview, tokenization, PyTorch/resource accounting, architectures) are the prerequisites for assignment 1 — do not start coding before finishing them.",
          "Do the resource-accounting exercises alongside Lecture 2: count FLOPs and memory for a model by hand before you ever call `.cuda()`. This habit is what the rest of the course assumes.",
          "Treat the systems lectures (GPUs/TPUs, kernels, parallelism) as a first pass, not mastery. You need the vocabulary now; assignment 2 is where it lands.",
          "Take notes as a running list of 'things I could not implement myself'. That list is your actual curriculum for the next two subtasks.",
          "Use the Spring 2025 recordings when a 2026 lecture is not yet posted or the older explanation is clearer — the executable lecture notes for 2025 are public on GitHub."
        ],
        "lectures": [
          {
            "name": "CS336: Language Modeling from Scratch — course site (current iteration)",
            "url": "https://cs336.stanford.edu/"
          },
          {
            "name": "CS336 Spring 2026 lecture playlist (Stanford Online)",
            "url": "https://www.youtube.com/playlist?list=PLoROMvodv4rMqXOcazWaTUHhq-yembLCV"
          },
          {
            "name": "CS336 Spring 2025 lecture playlist (fallback / alternate explanations)",
            "url": "https://www.youtube.com/playlist?list=PLoROMvodv4rOY23Y0BoGoBGgQ1zmU_MT_"
          },
          {
            "name": "CS336 Spring 2025 executable lecture notes",
            "url": "https://stanford-cs336.github.io/spring2025-lectures/"
          }
        ],
        "videos": [
          {
            "title": "CS336 Lecture 1: Overview and Tokenization (Spring 2025)",
            "url": "https://www.youtube.com/watch?v=SQ3fZ1sAqXI"
          }
        ],
        "papers": [
          {
            "name": "Scaling Laws for Neural Language Models (Kaplan et al.)",
            "url": "https://arxiv.org/abs/2001.08361"
          },
          {
            "name": "Training Compute-Optimal Large Language Models (Chinchilla, Hoffmann et al.)",
            "url": "https://arxiv.org/abs/2203.15556"
          },
          {
            "name": "The Pile: An 800GB Dataset of Diverse Text (Gao et al.)",
            "url": "https://arxiv.org/abs/2101.00027"
          }
        ]
      },
      "Implement assignment1-basics": {
        "desc": "Assignment 1 makes you build a byte-level BPE tokenizer, a transformer LM, and AdamW with a cosine schedule — all from primitives, then train it end to end. The course ships a test suite; passing it is a hard, honest pass/fail signal that your makemore-level understanding actually generalizes.",
        "steps": [
          "Clone `stanford-cs336/assignment1-basics`, set the environment up with `uv sync`, and run `uv run pytest` immediately. Everything failing is the correct starting state — that red output is your spec.",
          "Read `cs336_assignment1_basics.pdf` cover to cover before writing code. It defines exact tensor shapes and semantics; guessing them costs more time than reading.",
          "Implement BPE training first (merge counting, pretokenization regex, special tokens), then encode/decode. Test round-trip fidelity on adversarial inputs — emoji, multibyte UTF-8, whitespace runs — not just ASCII.",
          "Implement the model pieces the tests ask for individually — RMSNorm, RoPE, SwiGLU, scaled dot-product and multi-head attention, the transformer block — and get each test green before assembling the whole LM.",
          "Implement AdamW yourself plus cosine-with-warmup LR scheduling and gradient clipping. Check your AdamW against `torch.optim.AdamW` on a toy quadratic; the parameter trajectories should match closely.",
          "Train on TinyStories/OpenWebText-sample to a target validation loss, then generate samples with temperature and top-p. Profile your BPE trainer — if it takes hours, the bug is algorithmic, not hardware.",
          "Success criteria: the full `pytest` suite green, plus a training run whose validation loss curve you can explain line by line."
        ],
        "docs": [
          {
            "name": "stanford-cs336/assignment1-basics (starter code + test suite)",
            "url": "https://github.com/stanford-cs336/assignment1-basics"
          },
          {
            "name": "Assignment 1 handout PDF (the actual spec)",
            "url": "https://github.com/stanford-cs336/assignment1-basics/blob/main/cs336_assignment1_basics.pdf"
          },
          {
            "name": "assignment1-basics leaderboard (targets to beat once tests pass)",
            "url": "https://github.com/stanford-cs336/assignment1-basics-leaderboard"
          },
          {
            "name": "pytest — how to invoke and select tests",
            "url": "https://docs.pytest.org/en/stable/how-to/usage.html"
          },
          {
            "name": "`torch.optim` — reference AdamW and LR schedulers",
            "url": "https://docs.pytorch.org/docs/stable/optim.html"
          }
        ],
        "papers": [
          {
            "name": "Neural Machine Translation of Rare Words with Subword Units (BPE, Sennrich et al.)",
            "url": "https://arxiv.org/abs/1508.07909"
          },
          {
            "name": "Adam: A Method for Stochastic Optimization (Kingma & Ba)",
            "url": "https://arxiv.org/abs/1412.6980"
          },
          {
            "name": "Root Mean Square Layer Normalization (Zhang & Sennrich)",
            "url": "https://arxiv.org/abs/1910.07467"
          }
        ],
        "videos": [
          {
            "title": "Let's build the GPT Tokenizer (Karpathy) — BPE, spelled out",
            "url": "https://www.youtube.com/watch?v=zduSFxRajkE"
          }
        ],
        "lectures": [
          {
            "name": "Hugging Face LLM Course — Byte-Pair Encoding tokenization",
            "url": "https://huggingface.co/learn/llm-course/chapter6/5"
          },
          {
            "name": "tiktoken — a fast reference BPE implementation to compare against",
            "url": "https://github.com/openai/tiktoken"
          }
        ]
      }
    },
    "p1-nanochat": {
      "Read the whole repo": {
        "desc": "nanochat is the full LLM pipeline — tokenization, pretraining, midtraining, SFT, RL, eval, and inference with a web UI — in one minimal, readable codebase. Reading all of it, before running any of it, is the fastest way to see how the stages you have studied separately actually connect.",
        "steps": [
          "Read `runs/speedrun.sh` first, top to bottom. It is the table of contents: every stage of the pipeline appears in order, as one command each.",
          "Read `nanochat/gpt.py` and diff it mentally against the transformer you built. Note every place Karpathy's choices differ from yours and write down why you think they differ.",
          "Follow the `--depth` knob through the code. Depth is the only complexity dial; width, head count, LR, training horizon, and weight decay are all derived from it. Find the exact lines that do that derivation.",
          "Trace one training script end to end (`scripts/base_train.py`): data loading, the optimizer setup in `nanochat/optim.py`, the step loop, checkpointing, evaluation.",
          "Read the post-training path — midtraining, SFT, then `scripts/chat_rl.py` — and be able to state in one sentence what each stage changes about the model's behaviour.",
          "Read `nanochat/engine.py` to see how inference and KV caching work, then skim the web UI to see how a served model is actually exposed.",
          "Success criteria: you can draw the whole pipeline on one page from memory, naming the script that implements each box."
        ],
        "docs": [
          {
            "name": "karpathy/nanochat — repo and README",
            "url": "https://github.com/karpathy/nanochat"
          },
          {
            "name": "`runs/speedrun.sh` — the whole pipeline in one file",
            "url": "https://github.com/karpathy/nanochat/blob/master/runs/speedrun.sh"
          },
          {
            "name": "`nanochat/gpt.py` — the model definition",
            "url": "https://github.com/karpathy/nanochat/blob/master/nanochat/gpt.py"
          },
          {
            "name": "`nanochat/engine.py` — inference and KV cache",
            "url": "https://github.com/karpathy/nanochat/blob/master/nanochat/engine.py"
          },
          {
            "name": "DeepWiki for nanochat — ask questions about the codebase",
            "url": "https://deepwiki.com/karpathy/nanochat"
          }
        ],
        "lectures": [
          {
            "name": "Introducing nanochat: The best ChatGPT that $100 can buy (Discussion #1 — the author's own walkthrough)",
            "url": "https://github.com/karpathy/nanochat/discussions/1"
          },
          {
            "name": "Beating GPT-2 for <$100: the nanochat journey (Discussion #481)",
            "url": "https://github.com/karpathy/nanochat/discussions/481"
          }
        ],
        "videos": [
          {
            "title": "Let's reproduce GPT-2 (124M) (Karpathy) — the predecessor walkthrough, still the best narration of this code style",
            "url": "https://www.youtube.com/watch?v=l8pRSuU81PU"
          }
        ]
      },
      "Run the speedrun": {
        "desc": "Rent an 8xH100 node and run `runs/speedrun.sh` start to finish — roughly two hours and about $48 at ~$3/GPU/hr — then talk to the model you trained. Nothing else in this phase produces the same visceral understanding of what a training run actually costs.",
        "steps": [
          "Boot an 8xH100 node (Lambda, RunPod, or similar). Confirm `nvidia-smi` shows 8 devices with 80GB each before you start paying attention to anything else.",
          "Set up with `uv sync --extra gpu` then `source .venv/bin/activate`. Start the run inside `screen` or `tmux` — a dropped SSH session mid-run is a $48 lesson.",
          "Launch `bash runs/speedrun.sh` and watch the first few hundred steps. Verify loss is falling and note your tokens/sec; if either looks wrong, kill it now rather than four hours in.",
          "While it runs, watch each stage transition — tokenizer, pretraining, midtraining, SFT, eval — and match what you see in the logs to the code you read.",
          "When it finishes, read the report card (CORE, and the eval numbers), then chat with the model via `python -m scripts.chat_cli` and the web UI. Ask it something it cannot know and watch it hallucinate confidently.",
          "Write down actual wall-clock time, actual dollar cost, and final metrics. These numbers are your baseline for the next subtask — and your first real intuition for compute budgeting.",
          "If you cannot justify the spend, run at lower depth (e.g. a 12-layer, GPT-1-sized model trains in minutes) or on a single GPU with `--device-batch-size` reduced; the pipeline is identical, just slower."
        ],
        "docs": [
          {
            "name": "nanochat README — setup, speedrun, cost, and single-GPU notes",
            "url": "https://github.com/karpathy/nanochat/blob/master/README.md"
          },
          {
            "name": "`runs/speedrun.sh` — the script you are running",
            "url": "https://github.com/karpathy/nanochat/blob/master/runs/speedrun.sh"
          },
          {
            "name": "`runs/runcpu.sh` — smoke-test the pipeline locally before renting GPUs",
            "url": "https://github.com/karpathy/nanochat/blob/master/runs/runcpu.sh"
          },
          {
            "name": "dev/LEADERBOARD.md — how to read and reproduce the time-to-GPT-2 numbers",
            "url": "https://github.com/karpathy/nanochat/blob/master/dev/LEADERBOARD.md"
          },
          {
            "name": "uv — installation (nanochat manages dependencies with it)",
            "url": "https://docs.astral.sh/uv/getting-started/installation/"
          }
        ],
        "videos": [
          {
            "title": "Train an LLM from Scratch with Karpathy's nanochat (Trelis Research) — a full recorded speedrun",
            "url": "https://www.youtube.com/watch?v=qra052AchPE"
          }
        ],
        "lectures": [
          {
            "name": "nanochat Discussions — other people's run logs, costs, and failure modes",
            "url": "https://github.com/karpathy/nanochat/discussions"
          }
        ]
      },
      "Change one thing and measure it": {
        "desc": "Run a single-variable experiment against your speedrun baseline and report the result honestly, including run-to-run noise. This is the smallest complete unit of ML research, and the discipline it teaches — never claim an effect you cannot separate from variance — is the whole job.",
        "steps": [
          "Establish variance before you establish effect: rerun your baseline config with a different seed and measure the spread in final val loss. Any 'improvement' smaller than that spread is not an improvement.",
          "Pick exactly one variable. Learning rate, warmup length, batch size, depth, weight decay, or a data mix change — one. Changing two makes the result uninterpretable, no matter how good it looks.",
          "Shrink the loop first. Use the ~5-minute 12-layer scale for iteration; only promote a change to a full-depth run once the small-scale signal is clear and repeated.",
          "Hold everything else fixed and log it: git commit, full config, seed, hardware, tokens seen. An unlogged run is not an experiment.",
          "Report effect size with units and uncertainty — 'val bpb 0.7185 -> 0.7161, seed-to-seed spread ±0.0009, n=3' — not 'it seems better'. State plainly if the change did nothing or made things worse.",
          "Write a short honest post-mortem: what you predicted, what happened, and what would have to be true for the result to be wrong. Post it to the nanochat Discussions if the finding is real.",
          "Success criteria: someone else could reproduce your claim from your write-up alone, and your conclusion survives you trying to argue against it."
        ],
        "docs": [
          {
            "name": "`runs/scaling_laws.sh` — the repo's own multi-scale experiment harness",
            "url": "https://github.com/karpathy/nanochat/blob/master/runs/scaling_laws.sh"
          },
          {
            "name": "dev/LEADERBOARD.md — how nanochat defines a valid, comparable result",
            "url": "https://github.com/karpathy/nanochat/blob/master/dev/LEADERBOARD.md"
          },
          {
            "name": "PyTorch reproducibility notes (seeding and nondeterminism)",
            "url": "https://docs.pytorch.org/docs/stable/notes/randomness.html"
          },
          {
            "name": "Weights & Biases experiment tracking guide",
            "url": "https://docs.wandb.ai/guides/track/"
          }
        ],
        "lectures": [
          {
            "name": "A Recipe for Training Neural Networks (Karpathy) — how to change one thing at a time",
            "url": "https://karpathy.github.io/2019/04/25/recipe/"
          },
          {
            "name": "nanochat miniseries v1 (Discussion #420) — a worked multi-scale experiment write-up",
            "url": "https://github.com/karpathy/nanochat/discussions/420"
          },
          {
            "name": "Beating GPT-2 for <$100 (Discussion #481) — how changes get reported and defended",
            "url": "https://github.com/karpathy/nanochat/discussions/481"
          }
        ],
        "papers": [
          {
            "name": "Scaling Laws for Neural Language Models (Kaplan et al.)",
            "url": "https://arxiv.org/abs/2001.08361"
          },
          {
            "name": "Training Compute-Optimal Large Language Models (Chinchilla, Hoffmann et al.)",
            "url": "https://arxiv.org/abs/2203.15556"
          }
        ]
      }
    },
    "p1-huggingface-stack": {
      "Load Open Weights": {
        "desc": "Gain hands-on experience loading and interacting with current open-weight LLMs. Note that `transformers` is v5.x now: it is PyTorch-only (TensorFlow and Flax/JAX support were removed) and it broke nearly all of the v4-era snippets you will find online, so pin an exact minor while you learn.",
        "steps": [
          "Install `transformers` (pin an exact 5.x minor), `accelerate`, and `huggingface_hub`.",
          "Authenticate with Hugging Face and download weights for `Qwen/Qwen3.5-4B`, or `HuggingFaceTB/SmolLM2-135M-Instruct` if you are on a laptop. Llama is frozen at v4 with no 2026 releases, so don't make it your default family.",
          "Instantiate model and tokenizer pipelines using PyTorch, and learn the v5 renames as you go: `torch_dtype` is now `dtype`, `load_in_4bit` is now `quantization_config=BitsAndBytesConfig(load_in_4bit=True)`, and the cache is controlled by `HF_HOME` rather than `TRANSFORMERS_CACHE`.",
          "Set up local GPU tensor mapping (device map) and perform forward passes."
        ],
        "courses": [
          {
            "name": "Hugging Face NLP Course",
            "url": "https://huggingface.co/learn/llm-course/chapter1/1"
          }
        ],
        "papers": [
          {
            "name": "Llama 3 Technical Report (Meta AI)",
            "url": "https://arxiv.org/abs/2407.21783"
          },
          {
            "name": "Gemma 2: Improving Open Language Models (Google DeepMind)",
            "url": "https://arxiv.org/abs/2408.00118"
          }
        ],
        "lectures": [
          {
            "name": "Stanford CS224N Lecture 11: Prompting & Open Weights",
            "url": "https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture09-peft.pdf"
          }
        ],
        "docs": [
          {
            "name": "Transformers Quick Start Guide",
            "url": "https://huggingface.co/docs/transformers/quicktour"
          }
        ],
        "videos": [
          {
            "title": "Hugging Face Transformers Tutorial",
            "url": "https://www.youtube.com/watch?v=QEaBAZQCtwE"
          }
        ],
        "podcasts": [
          {
            "title": "Latent Space: How to train your own Large Multimodal Model - with Hugo Laurencon & Leo Tronchon of HuggingFace M4 Research",
            "url": "https://www.latent.space/p/idefics"
          }
        ]
      },
      "Generation parameters": {
        "desc": "Understand and implement the sampling algorithms that convert model logits into textual output.",
        "steps": [
          "Study temperature scaling: dividing logits before softmax.",
          "Study Top-K and Top-P (Nucleus) filtering techniques.",
          "Write a text generation loop from scratch using raw logit sampling (no `.generate()`).",
          "Experiment with repetition penalties and analyze output behaviors."
        ],
        "courses": [],
        "papers": [
          {
            "name": "The Curious Case of Neural Text Degeneration (Holtzman et al. / Nucleus Sampling)",
            "url": "https://arxiv.org/abs/1904.09751"
          }
        ],
        "lectures": [
          {
            "name": "CMU Advanced NLP Lecture on Search & Generation",
            "url": "https://cmu-l3.github.io/anlp-fall2025/static_files/anlp-f2025-09-decoding.pdf"
          }
        ],
        "docs": [
          {
            "name": "How Generation Works in HF Transformers",
            "url": "https://huggingface.co/blog/how-to-generate"
          }
        ],
        "videos": [
          {
            "title": "LLM Decoding Strategies (Temperature, Top-K, Top-P)",
            "url": "https://www.youtube.com/watch?v=JqgsxC4guK4"
          }
        ]
      }
    }
  },
  "phase2.html": {
    "jax-d1": {
      "Pure functions only": {
        "desc": "Internalize functional purity in JAX to prevent tracing bugs.",
        "steps": [
          "Read 'Thinking in JAX' on purity.",
          "Learn to write stateless functions. Global state, list appends, and local mutations must be avoided.",
          "Verify calculations have no side-effects."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JAX Purity Rules Docs Guide",
            "url": "https://docs.jax.dev/en/latest/notebooks/Common_Gotchas_in_JAX.html#pure-functions"
          }
        ]
      },
      "Tracing model": {
        "desc": "Understand abstract value tracing in JAX compilation.",
        "steps": [
          "Study how tracer objects replace concrete arrays at trace time.",
          "Understand why standard python print() statements evaluate only during compilation.",
          "Explain tracing abstractions."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "How Tracing Works in JAX Manual",
            "url": "https://docs.jax.dev/en/latest/key-concepts.html#tracing"
          }
        ]
      },
      "Cause the failure modes": {
        "desc": "Intentionally cause tracer bugs to learn their error messages.",
        "steps": [
          "Cause a 'Leaked Tracer' error by returning an intermediate tracer out of scope.",
          "Write a python conditional (if statement) checking a traced value. Read the compile-time error.",
          "Perform an in-place array mutation (e.g. `x[0] = 1`) and observe JAX exceptions."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Common JAX Gotchas Guide",
            "url": "https://docs.jax.dev/en/latest/notebooks/Common_Gotchas_in_JAX.html"
          }
        ]
      }
    },
    "jax-d2": {
      "jax.grad basics": {
        "desc": "Master reverse-mode automatic differentiation in JAX.",
        "steps": [
          "Use `jax.grad` on scalar-output mathematical functions.",
          "Compute gradients of losses over parameters.",
          "Master `jax.value_and_grad` to retrieve a function's value and its gradient in one call, instead of running the forward pass twice."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JAX Autodiff Tutorial Docs",
            "url": "https://docs.jax.dev/en/latest/notebooks/autodiff_cookbook.html"
          }
        ]
      },
      "jacfwd vs jacrev": {
        "desc": "Understand forward vs reverse mode autodiff and their computational trade-offs.",
        "steps": [
          "Review Jacobian shapes: wide vs tall.",
          "Implement `jax.jacfwd` for operations with output dimensions larger than input dimensions.",
          "Implement `jax.jacrev` for target functions with output dimensions smaller than input dimensions."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Jacobian Calculation in JAX Manual",
            "url": "https://docs.jax.dev/en/latest/notebooks/autodiff_cookbook.html#jacobians-and-hessians-using-jacfwd-and-jacrev"
          }
        ]
      },
      "Higher-order grads": {
        "desc": "Calculate higher-order derivatives using JAX's composable transforms.",
        "steps": [
          "Calculate second derivatives using `jax.grad(jax.grad(f))`.",
          "Build Hessian calculation matrices combining forward and reverse sweeps (`jax.jacfwd(jax.jacrev(f))`)."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      }
    },
    "jax-d3": {
      "When jit recompiles": {
        "desc": "Avoid performance pitfalls caused by continuous compilation.",
        "steps": [
          "Verify JAX compilations are cached based on input shapes and dtypes.",
          "Observe performance drops when passing variable-length shapes.",
          "Learn to mark scalar config parameters using `static_argnums`."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JIT Compilation Guide Manual",
            "url": "https://docs.jax.dev/en/latest/notebooks/thinking_in_jax.html#just-in-time-compilation-with-jax-jit"
          }
        ]
      },
      "Debugging inside jit": {
        "desc": "Debug compiled graphs using specialized print and breakpoint primitives.",
        "steps": [
          "Use `jax.debug.print` to log dynamic values during compilation execution.",
          "Configure `jax.debug.breakpoint` to pause executions and debug shapes."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JAX Debugging Primitives Reference",
            "url": "https://docs.jax.dev/en/latest/debugging/index.html"
          }
        ]
      },
      "Benchmark jit speedup": {
        "desc": "Accurately benchmark compiled executions.",
        "steps": [
          "Learn to block asynchronous dispatch using `.block_until_ready()`.",
          "Measure compilation latency (first call) vs execution speed (subsequent calls)."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JAX Asynchronous Dispatch Manual",
            "url": "https://docs.jax.dev/en/latest/async_dispatch.html"
          }
        ]
      }
    },
    "jax-d4": {
      "vmap mental model": {
        "desc": "Vectorize single-sample calculations without manually rewriting shapes math.",
        "steps": [
          "Understand how `jax.vmap` adds dimension mapping parameters under the hood.",
          "Master `in_axes` and `out_axes` to vectorise functions across complex argument tuples."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Vectorization via Vmap Guide",
            "url": "https://docs.jax.dev/en/latest/notebooks/thinking_in_jax.html#auto-vectorization-with-jax-vmap"
          }
        ]
      },
      "Practical vmap uses": {
        "desc": "Build batching operators using vmap.",
        "steps": [
          "Implement per-example gradients calculations (`vmap(grad(loss))`).",
          "Compute pairwise vector distances without manual broadcasting expansions."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "Composing transforms": {
        "desc": "Stack JAX transforms to write clean, optimized modules.",
        "steps": [
          "Compose `jit(vmap(grad(loss)))` pipelines.",
          "Test compile times when nested transforms are configured."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      }
    },
    "jax-d5": {
      "Manual training loop (no libraries)": {
        "desc": "Build a neural network optimization loop using raw JAX operations.",
        "steps": [
          "Define linear layer weight parameters using standard JAX dictionaries.",
          "Write a jitted forward-loss step.",
          "Write a gradient step that updates weight parameters using SGD updates."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "Pytrees deep dive": {
        "desc": "Master JAX's core container abstraction for managing weight models.",
        "steps": [
          "Understand PyTree definition rules (dictionaries, lists, custom classes).",
          "Master the tree utilities: `jax.tree.map`, `jax.tree.leaves`, `jax.tree.flatten`, and `jax.tree.unflatten`. The older `jax.tree_util.tree_*` spellings still work and fill older codebases, but `jax.tree.*` is the modern namespace — write the new one, read the old one."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Pytree Abstraction Docs Manual",
            "url": "https://docs.jax.dev/en/latest/pytrees.html"
          }
        ]
      },
      "PRNG key management": {
        "desc": "Implement random operations using JAX's stateless random number model.",
        "steps": [
          "Understand why JAX does not use global seeds.",
          "Learn to split keys using `jax.random.split` before every randomized initialization or dropout step."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Stateless Random Numbers in JAX Gotchas",
            "url": "https://docs.jax.dev/en/latest/notebooks/Common_Gotchas_in_JAX.html#random-numbers"
          }
        ]
      }
    },
    "jax-d6": {
      "Flax NNX (current API)": {
        "desc": "Study stateful module architecture in Flax's modern NNX API.",
        "steps": [
          "Learn how NNX manages weights and variables as mutable attributes.",
          "Master explicit functional boundary conversion using `nnx.split` and `nnx.merge`."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Flax NNX Basics Guide Manual",
            "url": "https://flax.readthedocs.io/en/latest/nnx_basics.html"
          }
        ]
      },
      "Rebuild your MLP with Flax + Optax": {
        "desc": "Upgrade raw training loops to production-ready Flax/Optax pipelines.",
        "steps": [
          "Write your MLP definitions in Flax NNX.",
          "Initialize optimizers using Optax Adam configs.",
          "Run training step iterations."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "Optax transform chains": {
        "desc": "Chain gradient adjustments to control learning behaviors.",
        "steps": [
          "Combine clipping and optimization using `optax.chain`.",
          "Implement weight decays and gradient scaling updates."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Optax API Documentation Manual",
            "url": "https://optax.readthedocs.io/en/latest/"
          }
        ]
      }
    },
    "jax-d7": {
      "lax.scan mental model": {
        "desc": "Compile recurrent loops in XLA to prevent massive graph compile times.",
        "steps": [
          "Understand how python loops unroll during compilation.",
          "Implement `jax.lax.scan` to compile single-loop operations."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JAX Scan Operator Docs Manual",
            "url": "https://docs.jax.dev/en/latest/_autosummary/jax.lax.scan.html"
          }
        ]
      },
      "scan-based training loop": {
        "desc": "Compress entire training runs into single compiled loops.",
        "steps": [
          "Structure state variables (params, opt_state) as scan carry arguments.",
          "Implement metric recording arrays."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "lax.cond and while_loop": {
        "desc": "Implement conditional and variable loops inside compiled functions.",
        "steps": [
          "Learn why python `if` blocks require compile-time constants.",
          "Implement dynamic condition checking using `jax.lax.cond`.",
          "Implement dynamic loops using `jax.lax.while_loop`."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "JAX Control Flow Operators Gotchas",
            "url": "https://docs.jax.dev/en/latest/notebooks/Common_Gotchas_in_JAX.html#control-flow"
          }
        ]
      }
    },
    "jax-d8": {
      "Explicit sharding (the current default)": {
        "desc": "Explicit sharding became the default parallelism mode in JAX 0.9.0, so shardings now live in the type of an array and are visible at trace time rather than being inferred by the compiler. Learn this API first: pmap is gone, and everything downstream in this roadmap assumes a mesh.",
        "steps": [
          "Build a mesh with `jax.make_mesh((8,), ('data',), axis_types=(jax.sharding.AxisType.Explicit,))` and inspect `mesh.devices` and `mesh.axis_names`.",
          "Install it with `jax.set_mesh(mesh)` — note that the `with mesh:` context-manager form was deprecated in 0.10.1, so prefer the explicit setter or the function-scoped decorator form.",
          "Use the top-level `jax.P` alias (a PartitionSpec shorthand available since 0.7.0) to write `jax.NamedSharding(mesh, jax.P('data', None))` and pass it to `jax.device_put`.",
          "Print `jax.typeof(x)` and `jax.typeof(x).sharding` inside a `jax.jit`-traced function and confirm the sharding is part of the abstract type, not a runtime property.",
          "Force a layout change with `jax.reshard(x, jax.P(None, 'model'))` and read the resulting HLO to see the collective the compiler inserted.",
          "Read the 0.9.0 / 0.10.0 / 0.10.1 changelog entries and confirm for yourself that `PmapSharding`, `device_put_sharded` and `device_put_replicated` now raise AttributeError — do not copy any tutorial that still calls them."
        ],
        "docs": [
          {
            "name": "JAX — Distributed arrays and parallelization (explicit / auto / manual modes)",
            "url": "https://docs.jax.dev/en/latest/parallel.html"
          },
          {
            "name": "jax.make_mesh API reference",
            "url": "https://docs.jax.dev/en/latest/_autosummary/jax.make_mesh.html"
          },
          {
            "name": "jax.set_mesh API reference",
            "url": "https://docs.jax.dev/en/latest/_autosummary/jax.set_mesh.html"
          },
          {
            "name": "jax.typeof API reference (trace-time sharding queries)",
            "url": "https://docs.jax.dev/en/latest/_autosummary/jax.typeof.html"
          },
          {
            "name": "jax.sharding module (Mesh, NamedSharding, PartitionSpec, AxisType)",
            "url": "https://docs.jax.dev/en/latest/jax.sharding.html"
          }
        ],
        "lectures": [
          {
            "name": "JAX changelog — read the 0.9.0, 0.10.0 and 0.10.1 sections for the pmap removal and `with mesh:` deprecation",
            "url": "https://docs.jax.dev/en/latest/changelog.html"
          },
          {
            "name": "How To Scale Your Model — Sharded matrices and how to multiply them",
            "url": "https://jax-ml.github.io/scaling-book/sharding/"
          }
        ]
      },
      "Collective ops (pmean, psum)": {
        "desc": "Synchronize device values during multi-device training steps. The pattern you write today is jit + sharding (and `jax.shard_map` when you need manual control); pmap is maintenance-only legacy you learn to read, never to write.",
        "steps": [
          "Implement gradient averaging using lax.psum across the data mesh axis.",
          "Understand AllReduce: every device receives the sum of values from all devices. lax.pmean = psum / num_devices.",
          "Apply to a training loop: each device computes local gradients, average with pmean before optimizer step."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "shard_map for manual control": {
        "desc": "shard_map is the escape hatch: inside it you write per-device code and call collectives yourself, instead of letting the compiler choose. It graduated to the top level as `jax.shard_map`, and the `jax.experimental.shard_map` path is deprecated.",
        "steps": [
          "Import `jax.shard_map` from the top level and delete any `from jax.experimental.shard_map import shard_map` lines — the experimental path is deprecated.",
          "Write a `shard_map`-wrapped matmul with `in_specs=(jax.P('data', None), jax.P(None, None))` and `out_specs=jax.P('data', None)` and reason about what each device physically holds.",
          "Implement a manual all-reduce with `jax.lax.psum(x, 'data')` inside the body, and compare its result to the same computation expressed purely with explicit sharding.",
          "Deliberately pass an input whose PartitionSpec does not match `in_specs`: since 0.9.1 Explicit mode asserts instead of silently resharding, so you should get an error rather than a hidden collective.",
          "Toggle `check_vma` / unreduced outputs and observe how JAX tracks which axes a value has already been reduced over.",
          "Profile a shard_map version against the automatic-partitioning version of the same layer and record whether manual control actually bought you anything."
        ],
        "docs": [
          {
            "name": "jax.shard_map API reference (top-level, non-experimental)",
            "url": "https://docs.jax.dev/en/latest/_autosummary/jax.shard_map.html"
          },
          {
            "name": "SPMD multi-device parallelism with shard_map (tutorial)",
            "url": "https://docs.jax.dev/en/latest/notebooks/shard_map.html"
          },
          {
            "name": "Manual mode section of the JAX parallelism guide",
            "url": "https://docs.jax.dev/en/latest/parallel.html"
          }
        ],
        "lectures": [
          {
            "name": "How To Scale Your Model — collectives, AllReduce/AllGather/ReduceScatter costs",
            "url": "https://jax-ml.github.io/scaling-book/sharding/"
          }
        ]
      }
    },
    "jax-d9": {
      "Accelerator setup": {
        "desc": "Connect to the best accelerator you can access and make the hardware assumptions explicit.",
        "steps": [
          "Free Colab is GPU-only now, so take a Kaggle TPU, a paid 8-core GCP slice, or a TPU Research Cloud grant if you have one; otherwise set `jax.config.update(\"jax_num_cpu_devices\", 8)` to fake eight local devices, which is enough for every sharding exercise.",
          "Check device outputs using `jax.devices()` and record device type, memory, and runtime constraints."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "GPU vs TPU differences": {
        "desc": "Optimize computation sizes to match TPU hardware layouts.",
        "steps": [
          "Set data formatting to `bfloat16` to leverage TPU Matrix Multiply Units.",
          "Ensure dimension sizes are multiples of 128 to prevent padding inefficiencies."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "TPU Hardware Architecture Reference",
            "url": "https://docs.cloud.google.com/tpu/docs/intro-to-tpu"
          }
        ]
      },
      "Port your MLP to all 8 devices": {
        "desc": "Take the single-device MLP you already wrote and shard it across an 8-device mesh, data-parallel first and then tensor-parallel. The hardware story has changed: Colab no longer hands out TPU v2-8 slices, so pick one of the routes below before you start.",
        "steps": [
          "Pick your 8 devices: Kaggle notebooks (free TPUs, and where the scaling book now points readers), a GCP 8-core TPU slice, or a free-tier request through TPU Research Cloud.",
          "If you have no accelerator, fake it: `jax.config.update('jax_num_cpu_devices', 8)` before any JAX computation, or the older `XLA_FLAGS=--xla_force_host_platform_device_count=8` — then assert `len(jax.devices()) == 8`.",
          "Shard the batch: mesh axis `('data',)`, params replicated, activations `jax.P('data', None)`. Confirm loss curves match the single-device run bit-for-bit-ish before trusting anything else.",
          "Switch to tensor parallelism: shard the hidden dimension of your weight matrices, leave the batch replicated, and find where the compiler inserts the all-reduce.",
          "Build a 2D mesh `(2, 4)` named `('data', 'model')` and run both forms of parallelism at once.",
          "Measure step time and MFU for each configuration and write down why the numbers differ — the point of the exercise is the explanation, not the speedup."
        ],
        "docs": [
          {
            "name": "Kaggle TPU documentation (free TPU access)",
            "url": "https://www.kaggle.com/docs/tpu"
          },
          {
            "name": "TPU Research Cloud — free TPU access programme",
            "url": "https://sites.research.google/trc/about/"
          },
          {
            "name": "Google Cloud — run a JAX calculation on a TPU VM",
            "url": "https://cloud.google.com/tpu/docs/run-calculation-jax"
          },
          {
            "name": "JAX multi-process / multi-host programming guide",
            "url": "https://docs.jax.dev/en/latest/multi_process.html"
          },
          {
            "name": "How to fake multiple CPU devices in JAX (jeffcarp)",
            "url": "https://www.jeffcarp.com/posts/2025/fake-multiple-cpus-jax/"
          }
        ],
        "lectures": [
          {
            "name": "UvA DL Notebooks — Introduction to Distributed Computing in JAX",
            "url": "https://uvadlc-notebooks.readthedocs.io/en/latest/tutorial_notebooks/scaling/JAX/data_parallel_intro.html"
          },
          {
            "name": "Introduction to sharded computation (JAX tutorial)",
            "url": "https://docs.jax.dev/en/latest/sharded-computation.html"
          }
        ]
      }
    },
    "jax-d10": {
      "Transformer block from scratch": {
        "desc": "Implement a full attention transformer module in JAX/Flax NNX.",
        "steps": [
          "Write attention, feedforward sublayers, normalization, and skip connections.",
          "Compile the block using `jax.jit`."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      },
      "Basic JAX profiling": {
        "desc": "Capture execution logs to identify performance leaks.",
        "steps": [
          "Capture runs using `jax.profiler.start_trace`.",
          "Inspect TensorBoard graphs to analyze compilation delays."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Profiling JAX Programs Manual",
            "url": "https://docs.jax.dev/en/latest/profiling.html"
          }
        ]
      },
      "Start the scaling book": {
        "desc": "Begin mapping training resources to compute capacities.",
        "steps": [
          "Analyze the parameter-compute equation: $C = 6ND$."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Scaling Book Introduction Manual",
            "url": "https://jax-ml.github.io/scaling-book/"
          }
        ]
      }
    },
    "p2-scaling-book": {
      "Work the scaling book": {
        "desc": "Understand the physical relationships between model parameters, training data size, compute budgets, and hardware architectures.",
        "steps": [
          "Read the Scaling Book by the JAX ML team.",
          "Solve every paper-and-pencil exercise. Understand equations relating parameter count (N), token count (D), and FLOP count ($C \\approx 6ND$).",
          "Convert your written equations into LaTeX for permanent logging.",
          "Develop calculations for batch sizing, gradient accumulation, and learning rates under compute scaling limits."
        ],
        "courses": [
          {
            "name": "Distributed Systems (MIT 6.824)",
            "url": "https://pdos.csail.mit.edu/6.824/"
          }
        ],
        "papers": [
          {
            "name": "Scaling Laws for Neural Language Models (Kaplan et al.)",
            "url": "https://arxiv.org/abs/2001.08361"
          },
          {
            "name": "Training Compute-Optimal Large Language Models (Hoffmann et al. / Chinchilla)",
            "url": "https://arxiv.org/abs/2203.15556"
          }
        ],
        "lectures": [
          {
            "name": "JAX Scaling Book Notes (JAX Team)",
            "url": "https://jax-ml.github.io/scaling-book/"
          }
        ],
        "docs": [],
        "videos": [
          {
            "title": "Dwarkesh Patel × Reiner Pope: How to Scale LLMs on TPUs",
            "url": "https://www.dwarkesh.com/p/reiner-pope"
          }
        ],
        "podcasts": [
          {
            "title": "Dwarkesh Patel: Reiner Pope on Google TPUs and AI Scaling",
            "url": "https://www.dwarkesh.com/p/reiner-pope"
          }
        ]
      },
      "GPUs and the Ultra-Scale Playbook": {
        "desc": "The scaling book is TPU-first, but its GPU chapter maps the same roofline reasoning onto NVIDIA hardware. Pair it with HuggingFace's Ultra-Scale Playbook, which is the PyTorch-side counterpart and covers the parallelism zoo from 5D parallelism down to kernel-level overlap.",
        "steps": [
          "Read scaling-book Chapter 12, 'How to Think About GPUs', and write down the GPU equivalents of the TPU concepts you already know: SM vs. tensor core, NVLink domain vs. ICI torus, node vs. slice.",
          "Redo one arithmetic-intensity / roofline calculation from the TPU chapters using GPU numbers and see which regime flips from compute-bound to comms-bound.",
          "Work through the Ultra-Scale Playbook's parallelism sections and be able to state, unprompted, when tensor parallelism stops paying and pipeline or context parallelism takes over.",
          "Reconcile the two sources' vocabularies — the same collective has different names and different cost models on TPU and GPU. Keep a translation table.",
          "Pick one training configuration (e.g. a 7B model on 64 GPUs) and predict its step time from first principles, then compare against the playbook's reported numbers.",
          "Note where the two books disagree and figure out whether it is a hardware difference or a methodology difference."
        ],
        "courses": [
          {
            "name": "How To Scale Your Model (full book, Google DeepMind)",
            "url": "https://jax-ml.github.io/scaling-book/"
          },
          {
            "name": "The Ultra-Scale Playbook: Training LLMs on GPU Clusters (HuggingFace / nanotron)",
            "url": "https://huggingface.co/spaces/nanotron/ultrascale-playbook"
          }
        ],
        "lectures": [
          {
            "name": "Chapter 12 — How to Think About GPUs",
            "url": "https://jax-ml.github.io/scaling-book/gpus/"
          },
          {
            "name": "Chapter 3 — Sharded matrices and how to multiply them",
            "url": "https://jax-ml.github.io/scaling-book/sharding/"
          }
        ]
      },
      "Record your solutions": {
        "desc": "Implement peer verification checks on your math solutions to ensure perfect conceptual alignment.",
        "steps": [
          "Scan your handwritten solutions.",
          "Upload scans to an LLM assistant. Have it convert and format the formulas into clean LaTeX syntax.",
          "Check all scaling math assumptions against the verified equations in the Scaling Book repo."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Overleaf LaTeX Documentation Guide",
            "url": "https://www.overleaf.com/learn"
          }
        ]
      }
    },
    "p2-scaling-laws": {
      "Build JAX Transformer": {
        "desc": "Write a small causal language model using Flax NNX and compile it using XLA.",
        "steps": [
          "Implement Multi-Head Attention, MLP layers, and RMSNorm in Flax NNX.",
          "Construct a training pipeline using Optax optimizer chains.",
          "Test model forward passes and gradients on dummy sequences.",
          "Stretch only: document how a Mixture of Experts comparison would change the experiment design."
        ],
        "courses": [],
        "papers": [
          {
            "name": "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer",
            "url": "https://arxiv.org/abs/1701.06538"
          }
        ],
        "lectures": [
          {
            "name": "Sasha Rush's JAX Annotated Transformer Guide",
            "url": "https://srush.github.io/annotated-s4/"
          }
        ],
        "docs": [
          {
            "name": "Flax NNX API Reference Manual",
            "url": "https://flax.readthedocs.io/en/latest/index.html"
          }
        ]
      },
      "Toy Scaling Experiments": {
        "desc": "Replicate small loss-vs-compute curves without overstating what toy hardware can prove.",
        "steps": [
          "Set up a grid of training configurations varying model parameters (N), token counts (D), and compute budget within your hardware limits.",
          "Train models on available TPU/GPU/CPU hardware and record final evaluation cross-entropy, wall-clock time, and run metadata.",
          "Fit small loss-vs-compute curves with confidence intervals or bootstrap resampling where possible.",
          "Document limitations, failed runs, and whether any MoE experiment was a stretch-only comparison."
        ],
        "courses": [],
        "papers": [
          {
            "name": "Scaling Laws for Neural Language Models (Kaplan et al.)",
            "url": "https://arxiv.org/abs/2001.08361"
          },
          {
            "name": "Training Compute-Optimal Large Language Models (Hoffmann et al.)",
            "url": "https://arxiv.org/abs/2203.15556"
          }
        ],
        "lectures": [
          {
            "name": "LLM Pretraining and Scaling Seminar Notes (Stanford)",
            "url": "https://web.stanford.edu/class/cs224n/"
          }
        ],
        "docs": [],
        "videos": [
          {
            "title": "Chinchilla: Optimal Language Model Scaling (GenAI Level UP)",
            "url": "https://www.youtube.com/watch?v=_Ij_d6RB-6o"
          }
        ]
      }
    }
  },
  "phase3.html": {
    "p3-finetuning": {
      "LoRA from scratch": {
        "desc": "Implement Low-Rank Adaptation to understand how parameter parameter updates can be factored into lower-dimensional spaces.",
        "steps": [
          "Read the LoRA paper. Focus on the mathematical formulation: $W_{new} = W + \\Delta W$, where $\\Delta W = B \\times A \\cdot (\\alpha / r)$.",
          "Implement a custom `LoRALinear` module in PyTorch.",
          "Initialize matrix $A$ with a Gaussian distribution and matrix $B$ with zeros, ensuring no initial noise addition.",
          "Inject the custom LoRA layer into the transformer you built in Phase 1 (or into nanochat). Verify that only the adapter weights are optimized during gradients updates."
        ],
        "courses": [
          {
            "name": "Fine-Tuning Large Language Models (DeepLearning.AI)",
            "url": "https://www.deeplearning.ai/courses/finetuning-large-language-models"
          },
          {
            "name": "Free alternative: Hugging Face LLM Course - Fine-tuning",
            "url": "https://huggingface.co/learn/llm-course/chapter3/1"
          }
        ],
        "papers": [
          {
            "name": "LoRA: Low-Rank Adaptation of Large Language Models (Hu et al.)",
            "url": "https://arxiv.org/abs/2106.09685"
          }
        ],
        "lectures": [
          {
            "name": "Low-Rank Adaptation Lecture Notes (CMU NLP)",
            "url": "https://cmu-l3.github.io/anlp-fall2025/static_files/anlp-f2025-08-finetuning.pdf"
          }
        ],
        "docs": [
          {
            "name": "LoRA Implementation Guide (Lightning AI)",
            "url": "https://lightning.ai/lightning-ai/studios/code-lora-from-scratch"
          }
        ],
        "videos": [
          {
            "title": "LoRA Math & PyTorch from Scratch (Raschka)",
            "url": "https://www.youtube.com/watch?v=rgmJep4Sba4"
          }
        ]
      },
      "PEFT Pipeline with HF": {
        "desc": "Train an instruction-following adapter using standardized Hugging Face tuning libraries and documented data boundaries.",
        "steps": [
          "Install `peft`, `trl` (Transformer Reinforcement Learning), and `bitsandbytes`.",
          "Choose a base LLM that fits your hardware in 4-bit quantization (NF4 format) using QLoRA configurations.",
          "Create a dataset card documenting source, license, train/test split, and known leakage or contamination risks.",
          "Configure `LoraConfig` specifying target modules (e.g., q_proj, v_proj).",
          "Set up the TRL `SFTTrainer`, execute instruction-tuning, evaluate on a held-out set, and save adapter weights."
        ],
        "courses": [
          {
            "name": "Parameter-Efficient Fine-Tuning (Hugging Face Course)",
            "url": "https://huggingface.co/docs/peft/index"
          }
        ],
        "papers": [
          {
            "name": "QLoRA: Efficient Finetuning of Quantized LLMs (Dettmers et al.)",
            "url": "https://arxiv.org/abs/2305.14314"
          }
        ],
        "lectures": [
          {
            "name": "PEFT and Quantization Slides (Berkeley CS294-272)",
            "url": "https://agenticai-learning.org/f25"
          }
        ],
        "docs": [
          {
            "name": "TRL Supervised Fine-Tuning Guide",
            "url": "https://huggingface.co/docs/trl/sft_trainer"
          }
        ],
        "videos": [
          {
            "title": "How to Fine-tune LLMs with Unsloth: Complete Guide (pookie)",
            "url": "https://www.youtube.com/watch?v=Lt7KrFMcCis"
          }
        ],
        "podcasts": [
          {
            "title": "Latent Space: Fine-Tuning and Open Source LLMs",
            "url": "https://www.latent.space/p/axolotl"
          }
        ]
      }
    },
    "p3-rl-posttraining": {
      "Run a GRPO-family training loop": {
        "desc": "Get a real GRPO run working end to end on a small model with a verifiable reward, so that the RLVR papers you read next describe something you have actually watched train. Mind the defaults: TRL v1.9.0 (2026-07-21) flipped `loss_type` to `\"dapo\"`, and plain `\"grpo\"` is now explicitly marked not recommended because of its response-length bias.",
        "steps": [
          "Read the original GRPO formulation in the DeepSeekMath paper, then read the DAPO and Dr. GRPO papers to understand exactly which term the length bias comes from.",
          "Install current TRL and start a `GRPOTrainer` run on a small instruct model with a deterministic reward function (e.g. exact-match on GSM8K-style answers).",
          "Leave `loss_type` at its default `\"dapo\"`. If you want to see the bias, set it to `\"grpo\"` deliberately and plot mean completion length over training for both.",
          "Tune the group size, the number of generations, and the clip range; log reward, KL, and completion length together — length is the tell for reward hacking.",
          "Turn off the KL penalty (as DAPO does) and observe how fast the policy drifts from the reference.",
          "Reproduce your run twice with different seeds and report the spread, not the best run."
        ],
        "docs": [
          {
            "name": "TRL GRPOTrainer documentation (loss variants, defaults)",
            "url": "https://huggingface.co/docs/trl/main/en/grpo_trainer"
          },
          {
            "name": "TRL releases — check the v1.9.0 notes for the loss_type default flip",
            "url": "https://github.com/huggingface/trl/releases"
          },
          {
            "name": "TRL repository",
            "url": "https://github.com/huggingface/trl"
          }
        ],
        "papers": [
          {
            "name": "DeepSeekMath: Pushing the Limits of Mathematical Reasoning (original GRPO)",
            "url": "https://arxiv.org/abs/2402.03300"
          },
          {
            "name": "DAPO: An Open-Source LLM Reinforcement Learning System at Scale",
            "url": "https://arxiv.org/abs/2503.14476"
          },
          {
            "name": "Understanding R1-Zero-Like Training: A Critical Perspective (Dr. GRPO, length bias)",
            "url": "https://arxiv.org/abs/2503.20783"
          }
        ],
        "videos": [
          {
            "title": "Implementing RL Algorithms for LLMs — RLHF & Post-training Course, Lecture 4",
            "url": "https://www.youtube.com/watch?v=i-AIMpZHgeg"
          }
        ]
      },
      "Read the RLVR debate honestly": {
        "desc": "There is a live, unresolved argument about whether RLVR creates reasoning ability or merely sharpens what the base model could already sample. Read all four positions in order and hold the contradiction rather than picking a side early.",
        "steps": [
          "Read 'Does RL Really Incentivize Reasoning Capacity Beyond the Base Model?' and understand the pass@k methodology — the claim is specifically that the base model wins at large k.",
          "Read Spurious Rewards and internalise the model-dependence: random and incorrect rewards produce gains on Qwen but not on Llama or OLMo, which means many RLVR results are eliciting a pretraining prior, not teaching anything.",
          "Read ProRL as the rebuttal: with prolonged training and enough diversity, the reasoning boundary does expand.",
          "Read the two-stage reconciliation (2510.04028): early training exploits and narrows the distribution, prolonged training explores and expands it — this dissolves much of the apparent contradiction.",
          "Reproduce the core diagnostic yourself: evaluate a base model and an RLVR-tuned model at k = 1, 16, and 256 on the same task and plot both curves.",
          "Write one page stating which experiment would change your mind, and what you would need to run to settle it."
        ],
        "papers": [
          {
            "name": "Does Reinforcement Learning Really Incentivize Reasoning Capacity in LLMs Beyond the Base Model?",
            "url": "https://arxiv.org/abs/2504.13837"
          },
          {
            "name": "Spurious Rewards: Rethinking Training Signals in RLVR",
            "url": "https://arxiv.org/abs/2506.10947"
          },
          {
            "name": "ProRL: Prolonged RL Expands Reasoning Boundaries in Large Language Models",
            "url": "https://arxiv.org/abs/2505.24864"
          },
          {
            "name": "The Debate on RLVR Reasoning Capability Boundary: Shrinkage, Expansion, or Both?",
            "url": "https://arxiv.org/abs/2510.04028"
          }
        ],
        "videos": [
          {
            "title": "The Rise of Reasoning Models — RLHF & Post-training Course, Lecture 5",
            "url": "https://www.youtube.com/watch?v=o4AB5xHIDdM"
          }
        ]
      },
      "Learn what actually moves the number": {
        "desc": "Most published RL gains are noise, seed variance, or evaluation artefacts. This subtask is about developing a prior for which knobs have predictable, measurable effects on RL compute scaling, and which are cargo cult.",
        "steps": [
          "Read 'The Art of Scaling Reinforcement Learning Compute for LLMs' and note the central empirical claim: RL performance follows a sigmoidal compute curve, not a power law, so early-training extrapolation is misleading.",
          "Extract the paper's list of interventions that shift the asymptote versus those that only shift compute-efficiency — this distinction is the whole point.",
          "Work through the RLHF Book's chapters on policy gradients, reward modelling and regularisation to get the vocabulary straight.",
          "Follow the RLHF Book's companion lecture course, which is mapped chapter-by-chapter to the book.",
          "Fit a sigmoid to your own run's reward-versus-compute curve and check whether your extrapolation from the first third of training would have been right.",
          "Adopt a house rule: no claimed improvement gets reported without at least three seeds and a stated confidence interval."
        ],
        "papers": [
          {
            "name": "The Art of Scaling Reinforcement Learning Compute for LLMs",
            "url": "https://arxiv.org/abs/2510.13786"
          },
          {
            "name": "Reinforcement Learning from Human Feedback (the RLHF Book, arXiv edition)",
            "url": "https://arxiv.org/abs/2504.12501"
          }
        ],
        "courses": [
          {
            "name": "RLHF Book (free, online)",
            "url": "https://rlhfbook.com/"
          },
          {
            "name": "RLHF & Post-Training Course (Nathan Lambert)",
            "url": "https://rlhfbook.com/course"
          }
        ],
        "videos": [
          {
            "title": "RLHF and Post-training Overview — Lecture 1",
            "url": "https://www.youtube.com/watch?v=o6l6tJQgUg4"
          },
          {
            "title": "RLHF Foundations, IFT, Reward Modeling, Rejection Sampling — Lecture 2",
            "url": "https://www.youtube.com/watch?v=4gIwiSPmQkU"
          },
          {
            "title": "RLHF Book (and Post-Training) Course — full playlist",
            "url": "https://www.youtube.com/playlist?list=PLL1tdVxB1CpVpEtMHxwuR4uI4Lxjw00_y"
          }
        ]
      }
    },
    "p3-agent-eval": {
      "Survey evaluation tooling": {
        "desc": "Audit the eval tooling ecosystem before building anything custom. Know where your pipeline fits.",
        "steps": [
          "Clone lm-evaluation-harness and run it on MMLU or GSM8K. It is still the right tool for static benchmarks: understand the task abstraction, how it handles few-shot, batching, and score normalization.",
          "Read the Inspect (UK AI Safety Institute) documentation: understand how it structures tasks, solvers, scorers, and trace logging. This is the framework an evals candidate is most likely to be asked about, so note what it makes easy vs hard.",
          "Install Prime Intellect's `verifiers` and run one environment end to end. Understand how it packages an environment, its reward, and its rollouts as a reusable artifact rather than a one-off script.",
          "Decide: which tool (if any) will you use as eval infrastructure for your Phase 3 pipeline, or justify building custom? Document the decision and tradeoffs."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "EleutherAI lm-evaluation-harness",
            "url": "https://github.com/EleutherAI/lm-evaluation-harness"
          },
          {
            "name": "inspect-ai (AISI UK)",
            "url": "https://inspect.aisi.org.uk"
          },
          {
            "name": "Braintrust eval platform",
            "url": "https://www.braintrust.dev"
          }
        ],
        "podcasts": [
          {
            "title": "Hamel Husain: Evaluating LLMs in Practice",
            "url": "https://hamel.dev/blog/posts/evals/"
          }
        ]
      },
      "Learn to criticise a benchmark": {
        "desc": "Agent benchmarks rot faster than any other kind, and a large fraction of the ones you will see cited are dead, unmaintained, or never had a leaderboard at all. Learn to tell a live benchmark from a citation zombie, and to check whether a reported score actually followed the benchmark's own protocol.",
        "steps": [
          "Study the live ones first: Terminal-Bench 2.1 with the Harbor harness, tau2-bench, Mind2Web 2, and WorkArena-L2. For each, find the harness, the task count, and who maintains it.",
          "Read the Terminal-Bench 2.0/Harbor announcement and note why 2.1 exists — 26 tasks were changed to fix ambiguous specs and reward-hacking holes. Benchmarks that never get a 2.1 are a warning sign.",
          "Check the deprecation notice on the original tau-bench repo: it is archived in favour of tau2-bench and its README numbers are roughly 18 months stale. Anyone still quoting them is quoting a fossil.",
          "Study three dead-but-cited benchmarks — WebVoyager (which never had a leaderboard at all), WebGames, and AssistantBench — and work out why each stopped being informative.",
          "Learn protocol-compliance checking: open a submitted result JSON and look for fields like `followed_evaluation_protocol`. Results have shipped with that set to \"No\" and still been quoted as headline numbers.",
          "Run one benchmark yourself with the official harness, then again with a deliberately non-compliant setup, and record how far apart the two scores are."
        ],
        "docs": [
          {
            "name": "Terminal-Bench 2.1 + Harbor (official site and leaderboard)",
            "url": "https://www.tbench.ai/leaderboard"
          },
          {
            "name": "Terminal-Bench repository (harbor-framework)",
            "url": "https://github.com/harbor-framework/terminal-bench"
          },
          {
            "name": "tau2-bench — the maintained successor to tau-bench",
            "url": "https://github.com/sierra-research/tau2-bench"
          },
          {
            "name": "tau-bench (original, deprecated — read the notice, not the numbers)",
            "url": "https://github.com/sierra-research/tau-bench"
          },
          {
            "name": "Mind2Web 2 project page",
            "url": "https://osu-nlp-group.github.io/Mind2Web-2/"
          }
        ],
        "papers": [
          {
            "name": "Mind2Web 2: Evaluating Agentic Search with Agent-as-a-Judge",
            "url": "https://arxiv.org/abs/2506.21506"
          },
          {
            "name": "WorkArena++: Compositional Planning and Reasoning-based Common Knowledge Work Tasks (WorkArena-L2)",
            "url": "https://arxiv.org/abs/2407.05291"
          },
          {
            "name": "AssistantBench: Can Web Agents Solve Realistic and Time-Consuming Tasks? (a cautionary case study)",
            "url": "https://arxiv.org/abs/2407.15711"
          }
        ],
        "lectures": [
          {
            "name": "Introducing Terminal-Bench 2.0 and Harbor (announcement and design rationale)",
            "url": "https://www.tbench.ai/news/announcement-2-0"
          },
          {
            "name": "WebVoyager reference implementation — cited constantly, never had a leaderboard",
            "url": "https://github.com/MinorJerry/WebVoyager"
          },
          {
            "name": "WebGames repository",
            "url": "https://github.com/convergence-ai/webgames"
          }
        ]
      },
      "Design Controlled Experiment": {
        "desc": "Build a benchmark script that evaluates agentic reasoning behaviors under parameterized constraints and defensible data controls.",
        "steps": [
          "Pick a narrow reasoning task and define inclusion/exclusion rules for examples.",
          "Build a dataset card covering source, split policy, leakage checks, contamination risks, and licensing.",
          "Create baseline testing scripts with fixed temperature, system instructions, sampling seeds, and model versions.",
          "Define metrics, judge or human-review rubric, and ablation variables before running.",
          "Record accuracy, runtime latency, raw traces, confidence intervals, and run metadata over 100+ evaluations."
        ],
        "courses": [],
        "papers": [
          {
            "name": "AgentBench: Evaluating Language Agents in Desktop Environments",
            "url": "https://arxiv.org/abs/2308.03688"
          }
        ],
        "lectures": [
          {
            "name": "Hamel Husain: Evaluating LLMs in Practice",
            "url": "https://hamel.dev/blog/posts/evals/"
          }
        ],
        "docs": [],
        "videos": [
          {
            "title": "Deep Dive into LLM Evaluation with Weights & Biases (DeepLearningAI)",
            "url": "https://www.youtube.com/watch?v=7EcznH0-of8"
          }
        ]
      },
      "Failure mode analysis": {
        "desc": "Transition from overall score evaluation to diagnostic debugging by classifying failures and quantifying uncertainty.",
        "steps": [
          "Manually inspect agent trace logs where tasks failed.",
          "Define 4-5 core error categories (e.g., extraction formatting errors, hallucinated facts, reasoning loops).",
          "Use double review or spot adjudication for ambiguous classifications.",
          "Graph the distribution of error categories and include bootstrap confidence intervals.",
          "Run ablation checks to identify which factors mitigate specific failure classes."
        ],
        "courses": [],
        "papers": [
          {
            "name": "SWE-bench: Can Language Models Resolve Real-World GitHub Issues? (Jimenez et al.)",
            "url": "https://arxiv.org/abs/2310.06770"
          }
        ],
        "lectures": [
          {
            "name": "LLM System Debugging Best Practices (Anyscale Blog)",
            "url": "https://www.anyscale.com/blog"
          }
        ],
        "docs": [
          {
            "name": "LangChain Evals Documentation Manual",
            "url": "https://docs.langchain.com/oss/python/langchain/test/evals"
          }
        ]
      },
      "Build an environment": {
        "desc": "An environment is a task, a programmatic verifier, a reset, and a reward — nothing more. Building and publishing one is the fastest way to learn why most evals are unreliable, because you will be the one measuring your own run-to-run variance.",
        "steps": [
          "Pick a task with a machine-checkable answer. If you cannot write the verifier before the task, the task is not ready.",
          "Implement it against the Prime Intellect `verifiers` spec: dataset, rollout logic, and reward function, packaged as an installable module.",
          "Make reset genuinely hermetic — no leaked state between rollouts, no network dependence you do not control. Test this by running the same seed twice and diffing the trajectories.",
          "Run a fixed model 10+ times over the whole environment and report the standard deviation of the score, not just the mean. This number is your environment's noise floor and it bounds every claim anyone makes with it.",
          "Cross-implement the same task as an Inspect (UK AISI) eval and compare scores — disagreement between two harnesses on one task is a bug in at least one of them.",
          "Publish it to the Environments Hub with the variance number in the README, and treat any reported improvement smaller than your noise floor as unmeasured."
        ],
        "docs": [
          {
            "name": "verifiers — Prime Intellect's library for RL environments and evals",
            "url": "https://github.com/PrimeIntellect-ai/verifiers"
          },
          {
            "name": "verifiers documentation",
            "url": "https://verifiers.readthedocs.io/en/latest/"
          },
          {
            "name": "Prime Intellect Environments Hub",
            "url": "https://app.primeintellect.ai/dashboard/environments"
          },
          {
            "name": "Prime Intellect docs — building an environment",
            "url": "https://docs.primeintellect.ai/tutorials-environments/environments"
          },
          {
            "name": "Inspect (UK AI Security Institute) — evaluation framework",
            "url": "https://inspect.aisi.org.uk/"
          }
        ],
        "lectures": [
          {
            "name": "Environments Hub: A Community Hub To Scale RL To Open AGI (design writeup)",
            "url": "https://www.primeintellect.ai/blog/environments"
          },
          {
            "name": "Inspect scorers — how to write a programmatic verifier",
            "url": "https://inspect.aisi.org.uk/scorers.html"
          },
          {
            "name": "Inspect getting-started tutorial",
            "url": "https://inspect.aisi.org.uk/tutorial.html"
          }
        ],
        "podcasts": [
          {
            "title": "Latent Space — Multi-Turn RL for Multi-Hour Agents, with Will Brown (Prime Intellect)",
            "url": "https://www.latent.space/p/willccbb"
          },
          {
            "title": "Sequoia — Building the GitHub for RL Environments, with Will Brown & Johannes Hagemann",
            "url": "https://www.sequoiacap.com/podcast/building-the-github-for-rl-environments-prime-intellects-will-brown-johannes-hagemann/"
          }
        ]
      }
    },
    "p3-lit-review": {
      "Vlad's Pretraining Lecture": {
        "desc": "Understand the exact recipe, data constraints, and token allocations used in state-of-the-art pretraining.",
        "steps": [
          "Read Vlad Feinberg's pretraining lecture summary logs.",
          "Study pretraining data mixtures (web scrapes, books, code) and token scaling rules.",
          "Understand how training stability is managed at cluster scales (dealing with loss spikes and inf gradients)."
        ],
        "courses": [],
        "papers": [],
        "lectures": [
          {
            "name": "Gemini Flash Pretraining Logs (Vlad Feinberg)",
            "url": "https://vladfeinberg.com/2025/04/24/gemini-flash-pretraining.html"
          }
        ],
        "docs": []
      },
      "Post-Training Literature": {
        "desc": "Deep dive into model alignment, preferences, and reinforcement learning strategies.",
        "steps": [
          "Read InstructGPT paper (classic RLHF).",
          "Read Direct Preference Optimization (DPO) paper (bypasses reward modeling).",
          "Read Constitutional AI paper (RLAIF: AI feedback replaces human checks), then bring the reading current: GRPO-family RLVR (TRL now defaults to a DAPO-style loss and flags plain GRPO for length bias), the still-contested question of whether RLVR expands or merely narrows base-model capability, and on-policy distillation as a cheap compaction step after RLVR.",
          "Write an annotated summary describing the core math and contribution of each method. Use the RLHF Book and its companion lecture course as your spine, and Tulu 3 and Olmo 3 as the fully-open recipes to trace end to end."
        ],
        "courses": [
          {
            "name": "Reinforcement Learning from Human Feedback (Hugging Face Course)",
            "url": "https://huggingface.co/blog/rlhf"
          }
        ],
        "papers": [
          {
            "name": "Training language models to follow instructions (Ouyang et al. / InstructGPT)",
            "url": "https://arxiv.org/abs/2203.02155"
          },
          {
            "name": "Direct Preference Optimization (Rafailov et al. / DPO)",
            "url": "https://arxiv.org/abs/2305.18290"
          },
          {
            "name": "Constitutional AI: Harmlessness from AI Feedback (Bai et al.)",
            "url": "https://arxiv.org/abs/2212.08073"
          }
        ],
        "lectures": [
          {
            "name": "Alignment and Post-Training Slides (Stanford CS224N)",
            "url": "https://web.stanford.edu/class/cs224n/slides_w26/cs224n-2026-lecture08-posttraining.pdf"
          }
        ],
        "docs": [],
        "podcasts": [
          {
            "title": "Latent Space: Preference Optimization and DPO",
            "url": "https://www.latent.space/p/rlhf-201"
          }
        ]
      },
      "Reasoning, reward models & what replaced PRMs": {
        "desc": "Trace one arc end to end: process reward models were the 2023 answer to credit assignment, DeepSeek-R1 showed a simple outcome reward plus scale beat them for maths, and the field then split — generative step-level critique survived on the verifiable side, while rubrics and checklists took over everywhere the answer cannot be checked.",
        "steps": [
          "Read 'Let's Verify Step by Step' and be precise about what it actually demonstrated: dense process supervision beat outcome supervision at a fixed, small scale, on MATH.",
          "Read the DeepSeek-R1 paper's discussion of why they abandoned PRMs — reward hacking and the cost of maintaining the step labeller — and treat this as the moment PRMs lost the maths credit-assignment argument.",
          "Read 'The Lessons of Developing Process Reward Models in Mathematical Reasoning' for what did survive: consensus filtering and LLM-as-judge style generative critique rather than pure Monte-Carlo step labels.",
          "Move to the non-verifiable side: read Rubrics as Rewards and Checklists Are Better Than Reward Models, and note that both replace a learned scalar with an explicit, human-legible criterion list.",
          "Read the HealthBench paper as the strongest deployed instance of rubric grading, and study how its physician-written rubrics are actually scored.",
          "Write the arc as a single page with dates, and state what you think the next replacement will be and what evidence would show it."
        ],
        "papers": [
          {
            "name": "Let's Verify Step by Step (process supervision, PRMs)",
            "url": "https://arxiv.org/abs/2305.20050"
          },
          {
            "name": "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning",
            "url": "https://arxiv.org/abs/2501.12948"
          },
          {
            "name": "The Lessons of Developing Process Reward Models in Mathematical Reasoning",
            "url": "https://arxiv.org/abs/2501.07301"
          },
          {
            "name": "Rubrics as Rewards: Reinforcement Learning Beyond Verifiable Domains",
            "url": "https://arxiv.org/abs/2507.17746"
          },
          {
            "name": "Checklists Are Better Than Reward Models For Aligning Language Models",
            "url": "https://arxiv.org/abs/2507.18624"
          }
        ],
        "docs": [
          {
            "name": "HealthBench: Evaluating LLMs Towards Improved Human Health (rubric grading at scale)",
            "url": "https://arxiv.org/abs/2505.08775"
          }
        ],
        "courses": [
          {
            "name": "RLHF Book — reward modelling and reasoning chapters",
            "url": "https://rlhfbook.com/"
          }
        ],
        "videos": [
          {
            "title": "The Rise of Reasoning Models — RLHF & Post-training Course, Lecture 5",
            "url": "https://www.youtube.com/watch?v=o4AB5xHIDdM"
          }
        ],
        "podcasts": [
          {
            "title": "Latent Space: The RLVR Revolution - with Nathan Lambert (AI2, Interconnects.ai)",
            "url": "https://www.latent.space/p/the-rlvr-revolution-with-nathan-lambert"
          }
        ]
      }
    }
  },
  "phase4.html": {
    "p4-capstone-project": {
      "Formalize your study": {
        "desc": "Turn your strongest study into a reproducible technical report with visible methodology and limitations. The write-up is table stakes in 2026 — it documents and supports your runnable artifact, it does not substitute for one.",
        "steps": [
          "Create an Overleaf workspace or repo-based LaTeX report using a standard workshop template.",
          "Write an abstract, introduction, system architecture, methodology, dataset card, evaluation, limitations, and results sections.",
          "Incorporate clean graphs plotting evaluations, ablations, confidence intervals, and error distributions.",
          "Add a reproducibility appendix with commands, model versions, dataset hashes, and hardware notes, plus honest reliability numbers for the runnable environment the report is about."
        ],
        "courses": [],
        "papers": [],
        "lectures": [
          {
            "name": "How to Write a Great Research Paper (Simon Peyton Jones)",
            "url": "https://www.microsoft.com/en-us/research/academic-program/write-great-research-paper/"
          }
        ],
        "docs": [
          {
            "name": "Overleaf NeurIPS Template Guides",
            "url": "https://www.overleaf.com/gallery/tagged/neurips"
          }
        ]
      },
      "Incorporate peer feedback": {
        "desc": "Validate your research findings by exposing them to targeted critique and rerunning the most important checks.",
        "steps": [
          "Ask two or more researchers, practitioners, or strong engineers for targeted review of methodology, sample selection, baselines, and claims.",
          "Revise the report based on feedback and rerun the key experiments or ablations most likely to change the conclusion.",
          "Include negative results and limitations explicitly. Optionally share the final report publicly for broader discussion."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": []
      }
    },
    "p4-open-source": {
      "Identify framework PRs": {
        "desc": "Locate high-signal open issues inside major libraries that power evaluation, environments, and instruction-tuning.",
        "steps": [
          "Open the GitHub repositories for `EleutherAI/lm-evaluation-harness`, `axolotl-ai-cloud/axolotl`, `huggingface/trl`, or the environment-and-eval stack that hiring teams actually name: Inspect and Prime Intellect's `verifiers`.",
          "Filter issues by: 'help wanted', 'good first issue', or 'evaluations'.",
          "Scope a contribution: adding a new metric, cleaning up tokenization bindings, or optimizing data streaming."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "LM Eval Harness Contribution Guide",
            "url": "https://github.com/EleutherAI/lm-evaluation-harness/blob/main/docs/CONTRIBUTING.md"
          }
        ]
      },
      "Submit code & merge PR": {
        "desc": "Execute industry-grade software contributions by getting code reviewed and merged into open-source core libraries.",
        "steps": [
          "Fork the repository, clone locally, and set up your development branch.",
          "Write the code additions. Implement extensive unit tests showing that imports and edge cases function.",
          "Open a clean Pull Request with a clear description, profiling details (if applicable), and tests logs. Address reviewer feedback to get it merged."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "GitHub Pull Request Guide Manual",
            "url": "https://docs.github.com/en/pull-requests/reference/pull-requests"
          }
        ]
      }
    },
    "p4-cold-email": {
      "Prepare the email": {
        "desc": "Package your public achievements into concise outreach notes. Lead with the roles that name this work explicitly — Anthropic's Research Engineer, Universes; OpenAI's Frontier Evals and Environments; Meta's evals roles covering benchmarks and RL environments — but one target is a fragile strategy. Identify 2–3 backups before sending anything.",
        "steps": [
          "Write a concise outreach message to each team whose posting names agentic environments or evals directly (primary targets). One paragraph: what you built, what the evidence shows, what role you're targeting.",
          "Identify 2–3 backup targets: applied research or evals teams at Anthropic, Cohere, Mistral, or xAI — and ML engineering roles that explicitly value eval methodology. Structured entry points like the Anthropic Fellows programme run on fixed application windows, so check those dates early rather than late.",
          "Customize framing for each target — same portfolio artifacts, different role-fit angle depending on what each team works on.",
          "Include in every message: your runnable environment with honest reliability numbers first, then the toy scaling report link, the walkthrough video of the transformer you built from scratch, reproducible study report, raw run logs, and any merged or in-review open-source PRs.",
          "Do not wait for one reply before sending others. Send in parallel."
        ],
        "courses": [],
        "papers": [],
        "lectures": [],
        "docs": [
          {
            "name": "Vlad Feinberg's About & Contact Page",
            "url": "https://vladfeinberg.com/about"
          }
        ]
      }
    }
  }
};
