// ── Web Components ───────────────────────────────────────────
class ProgressBar extends HTMLElement {
  static get observedAttributes() { return ['value']; }
  connectedCallback() {
    this.render();
  }
  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'value') {
      const fill = this.querySelector('.progress-fill');
      if (fill) {
        fill.style.width = newVal + '%';
      }
    }
  }
  render() {
    const val = this.getAttribute('value') || 0;
    this.innerHTML = `
      <div class="progress-track" style="width: 100%; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; display: block;">
        <div class="progress-fill" style="height: 100%; background: var(--accent); transition: width 0.3s ease; width: ${val}%"></div>
      </div>
    `;
  }
}
if (!customElements.get('progress-bar')) {
  customElements.define('progress-bar', ProgressBar);
}

class WeightBadge extends HTMLElement {
  static get observedAttributes() { return ['value']; }
  connectedCallback() {
    this.render();
  }
  attributeChangedCallback() {
    this.render();
  }
  render() {
    const val = this.getAttribute('value') || '1';
    this.innerHTML = `
      <span style="font-family: var(--mono); font-size: 10px; color: var(--muted2); background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 2px 6px; border-radius: 2px; white-space: nowrap; display: inline-block;">w: ${val}</span>
    `;
  }
}
if (!customElements.get('weight-badge')) {
  customElements.define('weight-badge', WeightBadge);
}

// ── Master Phase and Task Registry ────────────────────────────
const ALL_PHASES = {
  p0: {
    page: 'phase0.html',
    tasks: ['p0-operating-rhythm', 'p0-python-basics', 'p0-python-fluency', 'p0-numpy', 'p0-math-refresh', 'p0-algorithms', 'p0-git-tooling', 'p0-milestone']
  },
  p1: {
    page: 'phase1.html',
    tasks: ['p1-karpathy-hero', 'p1-pytorch-engineering', 'p1-cs336-basics', 'p1-modern-arch', 'p1-nanochat', 'p1-milestone']
  },
  p2: {
    page: 'phase2.html',
    tasks: ['p2-serving', 'p2-agent-harness', 'p2-environment-v0', 'p2-stats', 'p2-judge-validation', 'p2-eval-infra', 'p2-benchmark-audit', 'p2-rl-posttraining', 'p2-safety-evals', 'p2-environment', 'p2-milestone']
  },
  p3: {
    page: 'phase3.html',
    tasks: ['p3-jax-core', 'p3-scaling-book', 'p3-pytorch-distributed', 'p3-cs336-systems', 'p3-serving-performance', 'p3-milestone']
  },
  p4: {
    page: 'phase4.html',
    tasks: ['p4-environment-harden', 'p4-writeup', 'p4-opensource', 'p4-apply', 'p4-milestone']
  }
};

// Helper to find the page filename associated with a taskId
function getPageForTask(taskId) {
  for (const [phaseId, phaseInfo] of Object.entries(ALL_PHASES)) {
    if (phaseInfo.tasks.includes(taskId)) {
      return phaseInfo.page;
    }
  }
  return 'index.html';
}

// ── Static Weights Registry ──────────────────────────────────
const STATIC_WEIGHTS = {
  phases: {
    p0: 11, p1: 12, p2: 18, p3: 10, p4: 6
  },
  tasks: {
    // Phase 0
    'p0-operating-rhythm': 4, 'p0-python-basics': 12, 'p0-python-fluency': 8, 'p0-numpy': 4, 'p0-math-refresh': 8, 'p0-algorithms': 4, 'p0-git-tooling': 4, 'p0-milestone': 4,
    // Phase 1
    'p1-karpathy-hero': 12, 'p1-pytorch-engineering': 8, 'p1-cs336-basics': 16, 'p1-modern-arch': 4, 'p1-nanochat': 8, 'p1-milestone': 4,
    // Phase 2
    'p2-serving': 8, 'p2-agent-harness': 8, 'p2-environment-v0': 8, 'p2-stats': 8, 'p2-judge-validation': 4, 'p2-eval-infra': 8, 'p2-benchmark-audit': 8, 'p2-rl-posttraining': 12, 'p2-safety-evals': 4, 'p2-environment': 4, 'p2-milestone': 4,
    // Phase 3
    'p3-jax-core': 12, 'p3-scaling-book': 8, 'p3-pytorch-distributed': 8, 'p3-cs336-systems': 8, 'p3-serving-performance': 4, 'p3-milestone': 4,
    // Phase 4
    'p4-environment-harden': 8, 'p4-writeup': 4, 'p4-opensource': 8, 'p4-apply': 4, 'p4-milestone': 4
  },
  subtasks: {
    "phase0.html::p0-operating-rhythm::Go public on day one": 1,
    "phase0.html::p0-operating-rhythm::Join one community and actually show up": 1,
    "phase0.html::p0-operating-rhythm::Book your feedback checkpoints": 1,
    "phase0.html::p0-operating-rhythm::Make your practice machine-graded": 1,
    "phase0.html::p0-operating-rhythm::Put the buffer and the reviews in the calendar": 1,
    "phase0.html::p0-operating-rhythm::Diary the application deadlines today": 1,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs": 3,
    "phase0.html::p0-python-basics::Data structures and control flow": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes": 3,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file": 3,
    "phase0.html::p0-python-fluency::The idioms you will actually read": 2,
    "phase0.html::p0-python-fluency::Type annotations and tooling": 2,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup": 2,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff": 2,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher": 2,
    "phase0.html::p0-numpy::Think in arrays, not loops": 1,
    "phase0.html::p0-numpy::Core ops by hand": 1,
    "phase0.html::p0-numpy::Exit check: attention in einsum": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup": 2,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand": 2,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy": 2,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap": 2,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep": 1,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave": 1,
    "phase0.html::p0-git-tooling::The git you will actually use": 1,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene": 1,
    "phase0.html::p0-git-tooling::Workspace and profiling": 1,
    "phase1.html::p1-karpathy-hero::Build micrograd first": 2,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through": 2,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep": 2,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory": 2,
    "phase1.html::p1-karpathy-hero::Publish it, week 11": 2,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU": 2,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation": 2,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM": 2,
    "phase1.html::p1-pytorch-engineering::Numerical debugging": 2,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility": 2,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code": 3,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green": 3,
    "phase1.html::p1-cs336-basics::Transformer, green": 3,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run": 3,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit": 3,
    "phase1.html::p1-cs336-basics::Publish the green tests, week 17": 3,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck": 1,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy": 1,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing": 1,
    "phase1.html::p1-modern-arch::MLA and long context": 1,
    "phase1.html::p1-modern-arch::Hybrid and linear attention": 1,
    "phase1.html::p1-modern-arch::Quantization for people who run evals": 1,
    "phase1.html::p1-nanochat::Run the speedrun first": 2,
    "phase1.html::p1-nanochat::Then read the whole repo": 2,
    "phase1.html::p1-nanochat::Change one thing and measure it": 2,
    "phase1.html::p1-nanochat::Write it up honestly": 2,
    "phase2.html::p2-serving::Stand up vLLM": 1,
    "phase2.html::p2-serving::Continuous batching and paged KV cache": 1,
    "phase2.html::p2-serving::Read the PagedAttention paper": 1,
    "phase2.html::p2-serving::Prefix caching": 1,
    "phase2.html::p2-serving::Throughput versus latency, measured": 1,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness": 1,
    "phase2.html::p2-agent-harness::The loop, from a blank file": 2,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill": 2,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits": 2,
    "phase2.html::p2-agent-harness::Context compaction": 2,
    "phase2.html::p2-agent-harness::Speak MCP": 2,
    "phase2.html::p2-environment-v0::Pick a task you can verify without an LLM": 2,
    "phase2.html::p2-environment-v0::Write the four interfaces and nothing else": 2,
    "phase2.html::p2-environment-v0::Run two models and write down the numbers": 2,
    "phase2.html::p2-environment-v0::Publish it and say it is version zero": 2,
    "phase2.html::p2-stats::Decide the sample size before you run anything": 1,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day": 1,
    "phase2.html::p2-stats::Paired comparison and variance decomposition": 1,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes": 1,
    "phase2.html::p2-stats::Exit check: redo an old result honestly": 1,
    "phase2.html::p2-stats::Apply it to your own numbers": 1,
    "phase2.html::p2-judge-validation::Label the gold set yourself first": 1,
    "phase2.html::p2-judge-validation::Run the bias battery": 1,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores": 1,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning": 1,
    "phase2.html::p2-judge-validation::Decide what your environment needs": 1,
    "phase2.html::p2-eval-infra::A job queue over checkpoints": 1,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust": 1,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks": 1,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting": 1,
    "phase2.html::p2-eval-infra::A dashboard someone else can read": 1,
    "phase2.html::p2-eval-infra::Put your environment behind the queue": 1,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result": 1,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers": 1,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness": 1,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide": 1,
    "phase2.html::p2-benchmark-audit::Measure what a single number hides": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy": 1,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited": 1,
    "phase2.html::p2-benchmark-audit::Audit your own environment the same way": 1,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor": 1,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl": 1,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check": 1,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task": 1,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from": 1,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly": 1,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number": 1,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map": 1,
    "phase2.html::p2-rl-posttraining::Train against your own environment": 1,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly": 1,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial": 1,
    "phase2.html::p2-safety-evals::Evaluation awareness": 1,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap": 1,
    "phase2.html::p2-safety-evals::Ask what your environment would miss": 1,
    "phase2.html::p2-environment::Re-baseline it with real statistics": 1,
    "phase2.html::p2-environment::Add a validated judge, or justify not having one": 1,
    "phase2.html::p2-environment::Report reliability, not just accuracy": 1,
    "phase2.html::p2-environment::Make it consumable by a training loop": 1,
    "phase2.html::p2-environment::Publish v1 with a changelog against v0": 1,
    "phase3.html::p3-jax-core::Purity and the tracing model": 2,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit": 2,
    "phase3.html::p3-jax-core::vmap": 2,
    "phase3.html::p3-jax-core::lax.scan and structured control flow": 2,
    "phase3.html::p3-jax-core::Explicit sharding and meshes": 2,
    "phase3.html::p3-jax-core::Collectives and shard_map": 2,
    "phase3.html::p3-jax-core::Read pmap, never write it": 2,
    "phase3.html::p3-jax-core::Get devices without a budget": 2,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware": 1,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math": 1,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs": 1,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor": 1,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling": 1,
    "phase3.html::p3-scaling-book::The GPU counterpart": 1,
    "phase3.html::p3-pytorch-distributed::FSDP2": 1,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh": 1,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan": 1,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation": 1,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8": 1,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging": 1,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume": 1,
    "phase3.html::p3-cs336-systems::Watch the systems lectures": 2,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising": 2,
    "phase3.html::p3-cs336-systems::Triton fundamentals": 2,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton": 2,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding": 2,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving": 1,
    "phase3.html::p3-serving-performance::Quantization": 1,
    "phase3.html::p3-serving-performance::Speculative decoding": 1,
    "phase3.html::p3-serving-performance::SGLang and structured generation": 1,
    "phase4.html::p4-environment-harden::Re-measure it — eleven weeks have passed": 2,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control": 2,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it": 2,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty": 2,
    "phase4.html::p4-writeup::The technical report — not a preprint": 1,
    "phase4.html::p4-writeup::The README that does the actual work": 1,
    "phase4.html::p4-writeup::One blog post with a point of view": 1,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4": 3,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count": 3,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub": 3,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20": 1,
    "phase4.html::p4-apply::Structured programs are the real funnel": 1,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level": 1,
    "phase4.html::p4-apply::Send the version that leads with reliability": 1
  },
  steps: {
    "phase0.html::p0-operating-rhythm::Go public on day one::0": 3,
    "phase0.html::p0-operating-rhythm::Go public on day one::1": 2,
    "phase0.html::p0-operating-rhythm::Go public on day one::2": 3,
    "phase0.html::p0-operating-rhythm::Go public on day one::3": 1,
    "phase0.html::p0-operating-rhythm::Go public on day one::4": 1,
    "phase0.html::p0-operating-rhythm::Join one community and actually show up::0": 2,
    "phase0.html::p0-operating-rhythm::Join one community and actually show up::1": 1,
    "phase0.html::p0-operating-rhythm::Join one community and actually show up::2": 1,
    "phase0.html::p0-operating-rhythm::Join one community and actually show up::3": 1,
    "phase0.html::p0-operating-rhythm::Join one community and actually show up::4": 1,
    "phase0.html::p0-operating-rhythm::Book your feedback checkpoints::0": 1,
    "phase0.html::p0-operating-rhythm::Book your feedback checkpoints::1": 1,
    "phase0.html::p0-operating-rhythm::Book your feedback checkpoints::2": 1,
    "phase0.html::p0-operating-rhythm::Book your feedback checkpoints::3": 3,
    "phase0.html::p0-operating-rhythm::Book your feedback checkpoints::4": 1,
    "phase0.html::p0-operating-rhythm::Make your practice machine-graded::0": 1,
    "phase0.html::p0-operating-rhythm::Make your practice machine-graded::1": 2,
    "phase0.html::p0-operating-rhythm::Make your practice machine-graded::2": 1,
    "phase0.html::p0-operating-rhythm::Make your practice machine-graded::3": 2,
    "phase0.html::p0-operating-rhythm::Make your practice machine-graded::4": 1,
    "phase0.html::p0-operating-rhythm::Put the buffer and the reviews in the calendar::0": 1,
    "phase0.html::p0-operating-rhythm::Put the buffer and the reviews in the calendar::1": 1,
    "phase0.html::p0-operating-rhythm::Put the buffer and the reviews in the calendar::2": 1,
    "phase0.html::p0-operating-rhythm::Put the buffer and the reviews in the calendar::3": 1,
    "phase0.html::p0-operating-rhythm::Put the buffer and the reviews in the calendar::4": 1,
    "phase0.html::p0-operating-rhythm::Diary the application deadlines today::0": 1,
    "phase0.html::p0-operating-rhythm::Diary the application deadlines today::1": 1,
    "phase0.html::p0-operating-rhythm::Diary the application deadlines today::2": 1,
    "phase0.html::p0-operating-rhythm::Diary the application deadlines today::3": 1,
    "phase0.html::p0-operating-rhythm::Diary the application deadlines today::4": 1,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::0": 2,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::1": 2,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::2": 3,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::3": 1,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::4": 2,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::5": 3,
    "phase0.html::p0-python-basics::Set up, go public, write your first programs::6": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::0": 3,
    "phase0.html::p0-python-basics::Data structures and control flow::1": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::2": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::3": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::4": 3,
    "phase0.html::p0-python-basics::Data structures and control flow::5": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::0": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::1": 1,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::2": 1,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::3": 1,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::4": 2,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::5": 3,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file::0": 1,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file::1": 3,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file::2": 3,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file::3": 1,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file::4": 1,
    "phase0.html::p0-python-basics::Exit check: word frequencies from an empty file::5": 2,
    "phase0.html::p0-python-fluency::The idioms you will actually read::0": 3,
    "phase0.html::p0-python-fluency::The idioms you will actually read::1": 3,
    "phase0.html::p0-python-fluency::The idioms you will actually read::2": 3,
    "phase0.html::p0-python-fluency::The idioms you will actually read::3": 3,
    "phase0.html::p0-python-fluency::The idioms you will actually read::4": 3,
    "phase0.html::p0-python-fluency::The idioms you will actually read::5": 1,
    "phase0.html::p0-python-fluency::Type annotations and tooling::0": 1,
    "phase0.html::p0-python-fluency::Type annotations and tooling::1": 3,
    "phase0.html::p0-python-fluency::Type annotations and tooling::2": 2,
    "phase0.html::p0-python-fluency::Type annotations and tooling::3": 1,
    "phase0.html::p0-python-fluency::Type annotations and tooling::4": 2,
    "phase0.html::p0-python-fluency::Type annotations and tooling::5": 2,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup::0": 3,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup::1": 2,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup::2": 3,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup::3": 3,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup::4": 1,
    "phase0.html::p0-python-fluency::Async Python: asyncio and TaskGroup::5": 1,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff::0": 2,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff::1": 3,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff::2": 3,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff::3": 2,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff::4": 1,
    "phase0.html::p0-python-fluency::Bounded concurrency, retries and backoff::5": 3,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher::0": 3,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher::1": 1,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher::2": 3,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher::3": 2,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher::4": 3,
    "phase0.html::p0-python-fluency::Exit check: typed LRU cache and a concurrent fetcher::5": 2,
    "phase0.html::p0-numpy::Think in arrays, not loops::0": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::1": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::2": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::3": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::4": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::5": 3,
    "phase0.html::p0-numpy::Core ops by hand::0": 3,
    "phase0.html::p0-numpy::Core ops by hand::1": 3,
    "phase0.html::p0-numpy::Core ops by hand::2": 3,
    "phase0.html::p0-numpy::Core ops by hand::3": 3,
    "phase0.html::p0-numpy::Core ops by hand::4": 3,
    "phase0.html::p0-numpy::Core ops by hand::5": 3,
    "phase0.html::p0-numpy::Exit check: attention in einsum::0": 3,
    "phase0.html::p0-numpy::Exit check: attention in einsum::1": 1,
    "phase0.html::p0-numpy::Exit check: attention in einsum::2": 3,
    "phase0.html::p0-numpy::Exit check: attention in einsum::3": 1,
    "phase0.html::p0-numpy::Exit check: attention in einsum::4": 2,
    "phase0.html::p0-numpy::Exit check: attention in einsum::5": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup::0": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup::1": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup::2": 3,
    "phase0.html::p0-math-refresh::Linear algebra warmup::3": 3,
    "phase0.html::p0-math-refresh::Linear algebra warmup::4": 3,
    "phase0.html::p0-math-refresh::Linear algebra warmup::5": 1,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand::0": 3,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand::1": 3,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand::2": 1,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand::3": 3,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand::4": 2,
    "phase0.html::p0-math-refresh::Calculus and backprop by hand::5": 1,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy::0": 1,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy::1": 1,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy::2": 3,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy::3": 1,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy::4": 1,
    "phase0.html::p0-math-refresh::Probability, entropy and cross-entropy::5": 3,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap::0": 1,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap::1": 3,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap::2": 2,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap::3": 1,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap::4": 1,
    "phase0.html::p0-math-refresh::Sampling variance and the bootstrap::5": 3,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep::0": 1,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep::1": 2,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep::2": 2,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep::3": 2,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep::4": 1,
    "phase0.html::p0-algorithms::Complexity intuition, not interview prep::5": 1,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW::0": 3,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW::1": 3,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW::2": 3,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW::3": 3,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW::4": 2,
    "phase0.html::p0-algorithms::Derive and implement SGD, momentum, Adam and AdamW::5": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave::0": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave::1": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave::2": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave::3": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave::4": 1,
    "phase0.html::p0-algorithms::Watch the optimizer misbehave::5": 1,
    "phase0.html::p0-git-tooling::The git you will actually use::0": 1,
    "phase0.html::p0-git-tooling::The git you will actually use::1": 1,
    "phase0.html::p0-git-tooling::The git you will actually use::2": 1,
    "phase0.html::p0-git-tooling::The git you will actually use::3": 3,
    "phase0.html::p0-git-tooling::The git you will actually use::4": 2,
    "phase0.html::p0-git-tooling::The git you will actually use::5": 1,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene::0": 1,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene::1": 3,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene::2": 1,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene::3": 3,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene::4": 1,
    "phase0.html::p0-git-tooling::Linux, ssh and tmux hygiene::5": 2,
    "phase0.html::p0-git-tooling::Workspace and profiling::0": 1,
    "phase0.html::p0-git-tooling::Workspace and profiling::1": 2,
    "phase0.html::p0-git-tooling::Workspace and profiling::2": 3,
    "phase0.html::p0-git-tooling::Workspace and profiling::3": 3,
    "phase0.html::p0-git-tooling::Workspace and profiling::4": 3,
    "phase0.html::p0-git-tooling::Workspace and profiling::5": 1,
    "phase1.html::p1-karpathy-hero::Build micrograd first::0": 3,
    "phase1.html::p1-karpathy-hero::Build micrograd first::1": 3,
    "phase1.html::p1-karpathy-hero::Build micrograd first::2": 1,
    "phase1.html::p1-karpathy-hero::Build micrograd first::3": 3,
    "phase1.html::p1-karpathy-hero::Build micrograd first::4": 3,
    "phase1.html::p1-karpathy-hero::Build micrograd first::5": 1,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through::0": 3,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through::1": 3,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through::2": 3,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through::3": 1,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through::4": 3,
    "phase1.html::p1-karpathy-hero::Then makemore, all the way through::5": 1,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep::0": 3,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep::1": 1,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep::2": 3,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep::3": 2,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep::4": 1,
    "phase1.html::p1-karpathy-hero::Diagnostics you keep::5": 2,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory::0": 1,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory::1": 3,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory::2": 3,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory::3": 3,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory::4": 2,
    "phase1.html::p1-karpathy-hero::Exit check: autograd from memory::5": 1,
    "phase1.html::p1-karpathy-hero::Publish it, week 11::0": 1,
    "phase1.html::p1-karpathy-hero::Publish it, week 11::1": 3,
    "phase1.html::p1-karpathy-hero::Publish it, week 11::2": 3,
    "phase1.html::p1-karpathy-hero::Publish it, week 11::3": 1,
    "phase1.html::p1-karpathy-hero::Publish it, week 11::4": 1,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU::0": 3,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU::1": 3,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU::2": 1,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU::3": 1,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU::4": 3,
    "phase1.html::p1-pytorch-engineering::Input pipelines that do not starve the GPU::5": 1,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation::0": 3,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation::1": 2,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation::2": 2,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation::3": 3,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation::4": 3,
    "phase1.html::p1-pytorch-engineering::Mixed precision and gradient accumulation::5": 1,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM::0": 1,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM::1": 1,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM::2": 3,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM::3": 3,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM::4": 1,
    "phase1.html::p1-pytorch-engineering::Checkpoint, resume, and survive OOM::5": 1,
    "phase1.html::p1-pytorch-engineering::Numerical debugging::0": 3,
    "phase1.html::p1-pytorch-engineering::Numerical debugging::1": 1,
    "phase1.html::p1-pytorch-engineering::Numerical debugging::2": 2,
    "phase1.html::p1-pytorch-engineering::Numerical debugging::3": 1,
    "phase1.html::p1-pytorch-engineering::Numerical debugging::4": 1,
    "phase1.html::p1-pytorch-engineering::Numerical debugging::5": 3,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility::0": 2,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility::1": 2,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility::2": 1,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility::3": 1,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility::4": 2,
    "phase1.html::p1-pytorch-engineering::Experiment tracking and reproducibility::5": 2,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code::0": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code::1": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code::2": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code::3": 2,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code::4": 2,
    "phase1.html::p1-cs336-basics::Watch the lectures before touching the code::5": 2,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green::0": 2,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green::1": 1,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green::2": 2,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green::3": 1,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green::4": 1,
    "phase1.html::p1-cs336-basics::BPE tokenizer, green::5": 3,
    "phase1.html::p1-cs336-basics::Transformer, green::0": 3,
    "phase1.html::p1-cs336-basics::Transformer, green::1": 3,
    "phase1.html::p1-cs336-basics::Transformer, green::2": 3,
    "phase1.html::p1-cs336-basics::Transformer, green::3": 3,
    "phase1.html::p1-cs336-basics::Transformer, green::4": 1,
    "phase1.html::p1-cs336-basics::Transformer, green::5": 2,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run::0": 3,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run::1": 3,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run::2": 1,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run::3": 2,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run::4": 3,
    "phase1.html::p1-cs336-basics::Optimizer, training loop, and a real run::5": 1,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit::0": 2,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit::1": 2,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit::2": 3,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit::3": 1,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit::4": 3,
    "phase1.html::p1-cs336-basics::Exit check with explicit partial credit::5": 1,
    "phase1.html::p1-cs336-basics::Publish the green tests, week 17::0": 2,
    "phase1.html::p1-cs336-basics::Publish the green tests, week 17::1": 1,
    "phase1.html::p1-cs336-basics::Publish the green tests, week 17::2": 1,
    "phase1.html::p1-cs336-basics::Publish the green tests, week 17::3": 1,
    "phase1.html::p1-cs336-basics::Publish the green tests, week 17::4": 1,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck::0": 1,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck::1": 1,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck::2": 1,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck::3": 3,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck::4": 1,
    "phase1.html::p1-modern-arch::Attention, and the three fixes that stuck::5": 3,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy::0": 1,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy::1": 2,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy::2": 3,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy::3": 2,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy::4": 1,
    "phase1.html::p1-modern-arch::FlashAttention and the memory hierarchy::5": 2,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing::0": 3,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing::1": 1,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing::2": 1,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing::3": 1,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing::4": 3,
    "phase1.html::p1-modern-arch::Mixture of experts and load balancing::5": 3,
    "phase1.html::p1-modern-arch::MLA and long context::0": 3,
    "phase1.html::p1-modern-arch::MLA and long context::1": 1,
    "phase1.html::p1-modern-arch::MLA and long context::2": 1,
    "phase1.html::p1-modern-arch::MLA and long context::3": 1,
    "phase1.html::p1-modern-arch::MLA and long context::4": 1,
    "phase1.html::p1-modern-arch::MLA and long context::5": 1,
    "phase1.html::p1-modern-arch::Hybrid and linear attention::0": 1,
    "phase1.html::p1-modern-arch::Hybrid and linear attention::1": 1,
    "phase1.html::p1-modern-arch::Hybrid and linear attention::2": 3,
    "phase1.html::p1-modern-arch::Hybrid and linear attention::3": 3,
    "phase1.html::p1-modern-arch::Hybrid and linear attention::4": 1,
    "phase1.html::p1-modern-arch::Hybrid and linear attention::5": 3,
    "phase1.html::p1-modern-arch::Quantization for people who run evals::0": 1,
    "phase1.html::p1-modern-arch::Quantization for people who run evals::1": 1,
    "phase1.html::p1-modern-arch::Quantization for people who run evals::2": 2,
    "phase1.html::p1-modern-arch::Quantization for people who run evals::3": 1,
    "phase1.html::p1-modern-arch::Quantization for people who run evals::4": 3,
    "phase1.html::p1-modern-arch::Quantization for people who run evals::5": 3,
    "phase1.html::p1-nanochat::Run the speedrun first::0": 1,
    "phase1.html::p1-nanochat::Run the speedrun first::1": 3,
    "phase1.html::p1-nanochat::Run the speedrun first::2": 2,
    "phase1.html::p1-nanochat::Run the speedrun first::3": 1,
    "phase1.html::p1-nanochat::Run the speedrun first::4": 2,
    "phase1.html::p1-nanochat::Run the speedrun first::5": 1,
    "phase1.html::p1-nanochat::Then read the whole repo::0": 1,
    "phase1.html::p1-nanochat::Then read the whole repo::1": 3,
    "phase1.html::p1-nanochat::Then read the whole repo::2": 1,
    "phase1.html::p1-nanochat::Then read the whole repo::3": 2,
    "phase1.html::p1-nanochat::Then read the whole repo::4": 1,
    "phase1.html::p1-nanochat::Then read the whole repo::5": 3,
    "phase1.html::p1-nanochat::Change one thing and measure it::0": 3,
    "phase1.html::p1-nanochat::Change one thing and measure it::1": 1,
    "phase1.html::p1-nanochat::Change one thing and measure it::2": 2,
    "phase1.html::p1-nanochat::Change one thing and measure it::3": 1,
    "phase1.html::p1-nanochat::Change one thing and measure it::4": 2,
    "phase1.html::p1-nanochat::Change one thing and measure it::5": 2,
    "phase1.html::p1-nanochat::Write it up honestly::0": 1,
    "phase1.html::p1-nanochat::Write it up honestly::1": 1,
    "phase1.html::p1-nanochat::Write it up honestly::2": 3,
    "phase1.html::p1-nanochat::Write it up honestly::3": 1,
    "phase1.html::p1-nanochat::Write it up honestly::4": 2,
    "phase1.html::p1-nanochat::Write it up honestly::5": 3,
    "phase2.html::p2-serving::Stand up vLLM::0": 2,
    "phase2.html::p2-serving::Stand up vLLM::1": 3,
    "phase2.html::p2-serving::Stand up vLLM::2": 1,
    "phase2.html::p2-serving::Stand up vLLM::3": 1,
    "phase2.html::p2-serving::Stand up vLLM::4": 1,
    "phase2.html::p2-serving::Stand up vLLM::5": 2,
    "phase2.html::p2-serving::Continuous batching and paged KV cache::0": 1,
    "phase2.html::p2-serving::Continuous batching and paged KV cache::1": 1,
    "phase2.html::p2-serving::Continuous batching and paged KV cache::2": 3,
    "phase2.html::p2-serving::Continuous batching and paged KV cache::3": 1,
    "phase2.html::p2-serving::Continuous batching and paged KV cache::4": 1,
    "phase2.html::p2-serving::Continuous batching and paged KV cache::5": 2,
    "phase2.html::p2-serving::Read the PagedAttention paper::0": 3,
    "phase2.html::p2-serving::Read the PagedAttention paper::1": 3,
    "phase2.html::p2-serving::Read the PagedAttention paper::2": 3,
    "phase2.html::p2-serving::Read the PagedAttention paper::3": 1,
    "phase2.html::p2-serving::Read the PagedAttention paper::4": 1,
    "phase2.html::p2-serving::Read the PagedAttention paper::5": 3,
    "phase2.html::p2-serving::Prefix caching::0": 1,
    "phase2.html::p2-serving::Prefix caching::1": 3,
    "phase2.html::p2-serving::Prefix caching::2": 2,
    "phase2.html::p2-serving::Prefix caching::3": 2,
    "phase2.html::p2-serving::Prefix caching::4": 1,
    "phase2.html::p2-serving::Prefix caching::5": 3,
    "phase2.html::p2-serving::Throughput versus latency, measured::0": 3,
    "phase2.html::p2-serving::Throughput versus latency, measured::1": 3,
    "phase2.html::p2-serving::Throughput versus latency, measured::2": 1,
    "phase2.html::p2-serving::Throughput versus latency, measured::3": 1,
    "phase2.html::p2-serving::Throughput versus latency, measured::4": 1,
    "phase2.html::p2-serving::Throughput versus latency, measured::5": 1,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness::0": 1,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness::1": 1,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness::2": 1,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness::3": 2,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness::4": 3,
    "phase2.html::p2-serving::Wire the endpoint to an RL and eval harness::5": 3,
    "phase2.html::p2-agent-harness::The loop, from a blank file::0": 1,
    "phase2.html::p2-agent-harness::The loop, from a blank file::1": 3,
    "phase2.html::p2-agent-harness::The loop, from a blank file::2": 2,
    "phase2.html::p2-agent-harness::The loop, from a blank file::3": 1,
    "phase2.html::p2-agent-harness::The loop, from a blank file::4": 1,
    "phase2.html::p2-agent-harness::The loop, from a blank file::5": 3,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill::0": 3,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill::1": 3,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill::2": 1,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill::3": 2,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill::4": 3,
    "phase2.html::p2-agent-harness::Tool schema design is the actual skill::5": 3,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits::0": 1,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits::1": 2,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits::2": 1,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits::3": 1,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits::4": 2,
    "phase2.html::p2-agent-harness::Multi-turn state, error recovery, hard limits::5": 2,
    "phase2.html::p2-agent-harness::Context compaction::0": 3,
    "phase2.html::p2-agent-harness::Context compaction::1": 3,
    "phase2.html::p2-agent-harness::Context compaction::2": 3,
    "phase2.html::p2-agent-harness::Context compaction::3": 1,
    "phase2.html::p2-agent-harness::Context compaction::4": 2,
    "phase2.html::p2-agent-harness::Context compaction::5": 2,
    "phase2.html::p2-agent-harness::Speak MCP::0": 1,
    "phase2.html::p2-agent-harness::Speak MCP::1": 3,
    "phase2.html::p2-agent-harness::Speak MCP::2": 1,
    "phase2.html::p2-agent-harness::Speak MCP::3": 3,
    "phase2.html::p2-agent-harness::Speak MCP::4": 3,
    "phase2.html::p2-agent-harness::Speak MCP::5": 3,
    "phase2.html::p2-environment-v0::Pick a task you can verify without an LLM::0": 1,
    "phase2.html::p2-environment-v0::Pick a task you can verify without an LLM::1": 1,
    "phase2.html::p2-environment-v0::Pick a task you can verify without an LLM::2": 1,
    "phase2.html::p2-environment-v0::Pick a task you can verify without an LLM::3": 3,
    "phase2.html::p2-environment-v0::Pick a task you can verify without an LLM::4": 3,
    "phase2.html::p2-environment-v0::Write the four interfaces and nothing else::0": 3,
    "phase2.html::p2-environment-v0::Write the four interfaces and nothing else::1": 1,
    "phase2.html::p2-environment-v0::Write the four interfaces and nothing else::2": 2,
    "phase2.html::p2-environment-v0::Write the four interfaces and nothing else::3": 3,
    "phase2.html::p2-environment-v0::Write the four interfaces and nothing else::4": 1,
    "phase2.html::p2-environment-v0::Run two models and write down the numbers::0": 2,
    "phase2.html::p2-environment-v0::Run two models and write down the numbers::1": 2,
    "phase2.html::p2-environment-v0::Run two models and write down the numbers::2": 1,
    "phase2.html::p2-environment-v0::Run two models and write down the numbers::3": 2,
    "phase2.html::p2-environment-v0::Run two models and write down the numbers::4": 1,
    "phase2.html::p2-environment-v0::Publish it and say it is version zero::0": 1,
    "phase2.html::p2-environment-v0::Publish it and say it is version zero::1": 3,
    "phase2.html::p2-environment-v0::Publish it and say it is version zero::2": 1,
    "phase2.html::p2-environment-v0::Publish it and say it is version zero::3": 1,
    "phase2.html::p2-environment-v0::Publish it and say it is version zero::4": 1,
    "phase2.html::p2-stats::Decide the sample size before you run anything::0": 3,
    "phase2.html::p2-stats::Decide the sample size before you run anything::1": 1,
    "phase2.html::p2-stats::Decide the sample size before you run anything::2": 1,
    "phase2.html::p2-stats::Decide the sample size before you run anything::3": 1,
    "phase2.html::p2-stats::Decide the sample size before you run anything::4": 1,
    "phase2.html::p2-stats::Decide the sample size before you run anything::5": 2,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day::0": 1,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day::1": 3,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day::2": 3,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day::3": 1,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day::4": 3,
    "phase2.html::p2-stats::Read the error-bars paper and apply it the same day::5": 1,
    "phase2.html::p2-stats::Paired comparison and variance decomposition::0": 2,
    "phase2.html::p2-stats::Paired comparison and variance decomposition::1": 1,
    "phase2.html::p2-stats::Paired comparison and variance decomposition::2": 1,
    "phase2.html::p2-stats::Paired comparison and variance decomposition::3": 1,
    "phase2.html::p2-stats::Paired comparison and variance decomposition::4": 1,
    "phase2.html::p2-stats::Paired comparison and variance decomposition::5": 1,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes::0": 1,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes::1": 1,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes::2": 1,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes::3": 3,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes::4": 1,
    "phase2.html::p2-stats::Multiple comparisons and effect sizes::5": 3,
    "phase2.html::p2-stats::Exit check: redo an old result honestly::0": 3,
    "phase2.html::p2-stats::Exit check: redo an old result honestly::1": 2,
    "phase2.html::p2-stats::Exit check: redo an old result honestly::2": 1,
    "phase2.html::p2-stats::Exit check: redo an old result honestly::3": 3,
    "phase2.html::p2-stats::Exit check: redo an old result honestly::4": 2,
    "phase2.html::p2-stats::Exit check: redo an old result honestly::5": 1,
    "phase2.html::p2-stats::Apply it to your own numbers::0": 1,
    "phase2.html::p2-stats::Apply it to your own numbers::1": 1,
    "phase2.html::p2-stats::Apply it to your own numbers::2": 1,
    "phase2.html::p2-stats::Apply it to your own numbers::3": 1,
    "phase2.html::p2-stats::Apply it to your own numbers::4": 1,
    "phase2.html::p2-judge-validation::Label the gold set yourself first::0": 3,
    "phase2.html::p2-judge-validation::Label the gold set yourself first::1": 3,
    "phase2.html::p2-judge-validation::Label the gold set yourself first::2": 3,
    "phase2.html::p2-judge-validation::Label the gold set yourself first::3": 1,
    "phase2.html::p2-judge-validation::Label the gold set yourself first::4": 1,
    "phase2.html::p2-judge-validation::Label the gold set yourself first::5": 1,
    "phase2.html::p2-judge-validation::Run the bias battery::0": 2,
    "phase2.html::p2-judge-validation::Run the bias battery::1": 1,
    "phase2.html::p2-judge-validation::Run the bias battery::2": 1,
    "phase2.html::p2-judge-validation::Run the bias battery::3": 1,
    "phase2.html::p2-judge-validation::Run the bias battery::4": 1,
    "phase2.html::p2-judge-validation::Run the bias battery::5": 3,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores::0": 1,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores::1": 1,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores::2": 1,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores::3": 2,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores::4": 3,
    "phase2.html::p2-judge-validation::Rubrics and checklists, not scalar scores::5": 1,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning::0": 1,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning::1": 1,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning::2": 2,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning::3": 3,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning::4": 1,
    "phase2.html::p2-judge-validation::Calibration drift and version pinning::5": 2,
    "phase2.html::p2-judge-validation::Decide what your environment needs::0": 1,
    "phase2.html::p2-judge-validation::Decide what your environment needs::1": 3,
    "phase2.html::p2-judge-validation::Decide what your environment needs::2": 3,
    "phase2.html::p2-judge-validation::Decide what your environment needs::3": 3,
    "phase2.html::p2-judge-validation::Decide what your environment needs::4": 3,
    "phase2.html::p2-eval-infra::A job queue over checkpoints::0": 1,
    "phase2.html::p2-eval-infra::A job queue over checkpoints::1": 1,
    "phase2.html::p2-eval-infra::A job queue over checkpoints::2": 2,
    "phase2.html::p2-eval-infra::A job queue over checkpoints::3": 3,
    "phase2.html::p2-eval-infra::A job queue over checkpoints::4": 1,
    "phase2.html::p2-eval-infra::A job queue over checkpoints::5": 2,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust::0": 1,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust::1": 2,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust::2": 1,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust::3": 3,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust::4": 1,
    "phase2.html::p2-eval-infra::Caching and dedupe that you can trust::5": 2,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks::0": 1,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks::1": 1,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks::2": 1,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks::3": 3,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks::4": 1,
    "phase2.html::p2-eval-infra::Sandbox the agentic tasks::5": 3,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting::0": 3,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting::1": 3,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting::2": 1,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting::3": 3,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting::4": 3,
    "phase2.html::p2-eval-infra::Per-sample cost and token accounting::5": 1,
    "phase2.html::p2-eval-infra::A dashboard someone else can read::0": 3,
    "phase2.html::p2-eval-infra::A dashboard someone else can read::1": 1,
    "phase2.html::p2-eval-infra::A dashboard someone else can read::2": 1,
    "phase2.html::p2-eval-infra::A dashboard someone else can read::3": 1,
    "phase2.html::p2-eval-infra::A dashboard someone else can read::4": 2,
    "phase2.html::p2-eval-infra::A dashboard someone else can read::5": 2,
    "phase2.html::p2-eval-infra::Put your environment behind the queue::0": 2,
    "phase2.html::p2-eval-infra::Put your environment behind the queue::1": 1,
    "phase2.html::p2-eval-infra::Put your environment behind the queue::2": 2,
    "phase2.html::p2-eval-infra::Put your environment behind the queue::3": 3,
    "phase2.html::p2-eval-infra::Put your environment behind the queue::4": 2,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result::0": 1,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result::1": 1,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result::2": 3,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result::3": 1,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result::4": 1,
    "phase2.html::p2-benchmark-audit::Pick a live benchmark and a specific published result::5": 2,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers::0": 3,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers::1": 3,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers::2": 1,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers::3": 1,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers::4": 1,
    "phase2.html::p2-benchmark-audit::Read the protocol before you read the numbers::5": 3,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness::0": 2,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness::1": 1,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness::2": 1,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness::3": 3,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness::4": 3,
    "phase2.html::p2-benchmark-audit::Reproduce it with your own harness::5": 1,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide::0": 1,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide::1": 1,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide::2": 1,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide::3": 3,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide::4": 1,
    "phase2.html::p2-benchmark-audit::Learn where computer-use numbers hide::5": 3,
    "phase2.html::p2-benchmark-audit::Measure what a single number hides::0": 2,
    "phase2.html::p2-benchmark-audit::Measure what a single number hides::1": 1,
    "phase2.html::p2-benchmark-audit::Measure what a single number hides::2": 2,
    "phase2.html::p2-benchmark-audit::Measure what a single number hides::3": 1,
    "phase2.html::p2-benchmark-audit::Measure what a single number hides::4": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy::0": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy::1": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy::2": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy::3": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy::4": 1,
    "phase2.html::p2-benchmark-audit::Report the discrepancy::5": 3,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited::0": 1,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited::1": 1,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited::2": 2,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited::3": 3,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited::4": 1,
    "phase2.html::p2-benchmark-audit::Learn which benchmarks are dead and still cited::5": 3,
    "phase2.html::p2-benchmark-audit::Audit your own environment the same way::0": 3,
    "phase2.html::p2-benchmark-audit::Audit your own environment the same way::1": 1,
    "phase2.html::p2-benchmark-audit::Audit your own environment the same way::2": 1,
    "phase2.html::p2-benchmark-audit::Audit your own environment the same way::3": 1,
    "phase2.html::p2-benchmark-audit::Audit your own environment the same way::4": 3,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor::0": 3,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor::1": 3,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor::2": 1,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor::3": 2,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor::4": 3,
    "phase2.html::p2-rl-posttraining::LoRA from scratch — it is two matrices and a scale factor::5": 1,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl::0": 3,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl::1": 2,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl::2": 1,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl::3": 1,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl::4": 1,
    "phase2.html::p2-rl-posttraining::One real SFT run with peft and trl::5": 1,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check::0": 3,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check::1": 2,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check::2": 2,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check::3": 1,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check::4": 3,
    "phase2.html::p2-rl-posttraining::Dataset card and leakage check::5": 1,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task::0": 3,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task::1": 1,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task::2": 3,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task::3": 2,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task::4": 1,
    "phase2.html::p2-rl-posttraining::Run a GRPO-family loop on a verifiable task::5": 1,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from::0": 3,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from::1": 3,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from::2": 1,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from::3": 1,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from::4": 1,
    "phase2.html::p2-rl-posttraining::Know where GRPO and DAPO came from::5": 3,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly::0": 1,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly::1": 1,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly::2": 1,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly::3": 3,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly::4": 2,
    "phase2.html::p2-rl-posttraining::Read the RLVR capability debate honestly::5": 3,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number::0": 1,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number::1": 3,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number::2": 2,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number::3": 2,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number::4": 2,
    "phase2.html::p2-rl-posttraining::Learn what actually moves the number::5": 3,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map::0": 3,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map::1": 1,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map::2": 2,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map::3": 2,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map::4": 1,
    "phase2.html::p2-rl-posttraining::Fill in the post-training map::5": 3,
    "phase2.html::p2-rl-posttraining::Train against your own environment::0": 2,
    "phase2.html::p2-rl-posttraining::Train against your own environment::1": 1,
    "phase2.html::p2-rl-posttraining::Train against your own environment::2": 1,
    "phase2.html::p2-rl-posttraining::Train against your own environment::3": 1,
    "phase2.html::p2-rl-posttraining::Train against your own environment::4": 3,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly::0": 3,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly::1": 1,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly::2": 1,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly::3": 3,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly::4": 1,
    "phase2.html::p2-safety-evals::Read one frontier safety framework properly::5": 3,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial::0": 1,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial::1": 1,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial::2": 1,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial::3": 1,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial::4": 3,
    "phase2.html::p2-safety-evals::Sandbagging: when the eval is adversarial::5": 1,
    "phase2.html::p2-safety-evals::Evaluation awareness::0": 1,
    "phase2.html::p2-safety-evals::Evaluation awareness::1": 2,
    "phase2.html::p2-safety-evals::Evaluation awareness::2": 2,
    "phase2.html::p2-safety-evals::Evaluation awareness::3": 1,
    "phase2.html::p2-safety-evals::Evaluation awareness::4": 1,
    "phase2.html::p2-safety-evals::Evaluation awareness::5": 3,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap::0": 2,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap::1": 2,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap::2": 1,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap::3": 1,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap::4": 1,
    "phase2.html::p2-safety-evals::Run one real safety eval and measure the elicitation gap::5": 3,
    "phase2.html::p2-safety-evals::Ask what your environment would miss::0": 1,
    "phase2.html::p2-safety-evals::Ask what your environment would miss::1": 1,
    "phase2.html::p2-safety-evals::Ask what your environment would miss::2": 1,
    "phase2.html::p2-safety-evals::Ask what your environment would miss::3": 1,
    "phase2.html::p2-safety-evals::Ask what your environment would miss::4": 1,
    "phase2.html::p2-environment::Re-baseline it with real statistics::0": 2,
    "phase2.html::p2-environment::Re-baseline it with real statistics::1": 1,
    "phase2.html::p2-environment::Re-baseline it with real statistics::2": 1,
    "phase2.html::p2-environment::Re-baseline it with real statistics::3": 1,
    "phase2.html::p2-environment::Re-baseline it with real statistics::4": 3,
    "phase2.html::p2-environment::Add a validated judge, or justify not having one::0": 3,
    "phase2.html::p2-environment::Add a validated judge, or justify not having one::1": 3,
    "phase2.html::p2-environment::Add a validated judge, or justify not having one::2": 1,
    "phase2.html::p2-environment::Add a validated judge, or justify not having one::3": 1,
    "phase2.html::p2-environment::Add a validated judge, or justify not having one::4": 1,
    "phase2.html::p2-environment::Report reliability, not just accuracy::0": 3,
    "phase2.html::p2-environment::Report reliability, not just accuracy::1": 1,
    "phase2.html::p2-environment::Report reliability, not just accuracy::2": 1,
    "phase2.html::p2-environment::Report reliability, not just accuracy::3": 1,
    "phase2.html::p2-environment::Report reliability, not just accuracy::4": 2,
    "phase2.html::p2-environment::Make it consumable by a training loop::0": 1,
    "phase2.html::p2-environment::Make it consumable by a training loop::1": 1,
    "phase2.html::p2-environment::Make it consumable by a training loop::2": 1,
    "phase2.html::p2-environment::Make it consumable by a training loop::3": 2,
    "phase2.html::p2-environment::Make it consumable by a training loop::4": 1,
    "phase2.html::p2-environment::Publish v1 with a changelog against v0::0": 3,
    "phase2.html::p2-environment::Publish v1 with a changelog against v0::1": 1,
    "phase2.html::p2-environment::Publish v1 with a changelog against v0::2": 3,
    "phase2.html::p2-environment::Publish v1 with a changelog against v0::3": 3,
    "phase2.html::p2-environment::Publish v1 with a changelog against v0::4": 1,
    "phase3.html::p3-jax-core::Purity and the tracing model::0": 1,
    "phase3.html::p3-jax-core::Purity and the tracing model::1": 1,
    "phase3.html::p3-jax-core::Purity and the tracing model::2": 3,
    "phase3.html::p3-jax-core::Purity and the tracing model::3": 1,
    "phase3.html::p3-jax-core::Purity and the tracing model::4": 1,
    "phase3.html::p3-jax-core::Purity and the tracing model::5": 3,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit::0": 3,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit::1": 3,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit::2": 1,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit::3": 3,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit::4": 1,
    "phase3.html::p3-jax-core::grad, value_and_grad, and jit::5": 1,
    "phase3.html::p3-jax-core::vmap::0": 3,
    "phase3.html::p3-jax-core::vmap::1": 1,
    "phase3.html::p3-jax-core::vmap::2": 3,
    "phase3.html::p3-jax-core::vmap::3": 1,
    "phase3.html::p3-jax-core::vmap::4": 1,
    "phase3.html::p3-jax-core::vmap::5": 1,
    "phase3.html::p3-jax-core::lax.scan and structured control flow::0": 3,
    "phase3.html::p3-jax-core::lax.scan and structured control flow::1": 3,
    "phase3.html::p3-jax-core::lax.scan and structured control flow::2": 1,
    "phase3.html::p3-jax-core::lax.scan and structured control flow::3": 3,
    "phase3.html::p3-jax-core::lax.scan and structured control flow::4": 3,
    "phase3.html::p3-jax-core::lax.scan and structured control flow::5": 1,
    "phase3.html::p3-jax-core::Explicit sharding and meshes::0": 2,
    "phase3.html::p3-jax-core::Explicit sharding and meshes::1": 3,
    "phase3.html::p3-jax-core::Explicit sharding and meshes::2": 2,
    "phase3.html::p3-jax-core::Explicit sharding and meshes::3": 3,
    "phase3.html::p3-jax-core::Explicit sharding and meshes::4": 1,
    "phase3.html::p3-jax-core::Explicit sharding and meshes::5": 3,
    "phase3.html::p3-jax-core::Collectives and shard_map::0": 3,
    "phase3.html::p3-jax-core::Collectives and shard_map::1": 3,
    "phase3.html::p3-jax-core::Collectives and shard_map::2": 3,
    "phase3.html::p3-jax-core::Collectives and shard_map::3": 3,
    "phase3.html::p3-jax-core::Collectives and shard_map::4": 1,
    "phase3.html::p3-jax-core::Collectives and shard_map::5": 1,
    "phase3.html::p3-jax-core::Read pmap, never write it::0": 1,
    "phase3.html::p3-jax-core::Read pmap, never write it::1": 1,
    "phase3.html::p3-jax-core::Read pmap, never write it::2": 1,
    "phase3.html::p3-jax-core::Read pmap, never write it::3": 1,
    "phase3.html::p3-jax-core::Read pmap, never write it::4": 3,
    "phase3.html::p3-jax-core::Read pmap, never write it::5": 1,
    "phase3.html::p3-jax-core::Get devices without a budget::0": 1,
    "phase3.html::p3-jax-core::Get devices without a budget::1": 3,
    "phase3.html::p3-jax-core::Get devices without a budget::2": 1,
    "phase3.html::p3-jax-core::Get devices without a budget::3": 1,
    "phase3.html::p3-jax-core::Get devices without a budget::4": 3,
    "phase3.html::p3-jax-core::Get devices without a budget::5": 1,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware::0": 3,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware::1": 3,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware::2": 1,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware::3": 1,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware::4": 3,
    "phase3.html::p3-scaling-book::Chapters 1–2: rooflines and the hardware::5": 3,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math::0": 3,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math::1": 3,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math::2": 2,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math::3": 1,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math::4": 2,
    "phase3.html::p3-scaling-book::Chapters 3–4: sharding and transformer math::5": 1,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs::0": 1,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs::1": 2,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs::2": 3,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs::3": 1,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs::4": 1,
    "phase3.html::p3-scaling-book::Chapter 12: how to think about GPUs::5": 2,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor::0": 3,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor::1": 3,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor::2": 1,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor::3": 1,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor::4": 1,
    "phase3.html::p3-scaling-book::Chinchilla as the anchor::5": 1,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling::0": 1,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling::1": 1,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling::2": 1,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling::3": 3,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling::4": 1,
    "phase3.html::p3-scaling-book::Inference-aware and data-constrained scaling::5": 1,
    "phase3.html::p3-scaling-book::The GPU counterpart::0": 3,
    "phase3.html::p3-scaling-book::The GPU counterpart::1": 1,
    "phase3.html::p3-scaling-book::The GPU counterpart::2": 1,
    "phase3.html::p3-scaling-book::The GPU counterpart::3": 1,
    "phase3.html::p3-scaling-book::The GPU counterpart::4": 2,
    "phase3.html::p3-scaling-book::The GPU counterpart::5": 1,
    "phase3.html::p3-pytorch-distributed::FSDP2::0": 1,
    "phase3.html::p3-pytorch-distributed::FSDP2::1": 2,
    "phase3.html::p3-pytorch-distributed::FSDP2::2": 2,
    "phase3.html::p3-pytorch-distributed::FSDP2::3": 3,
    "phase3.html::p3-pytorch-distributed::FSDP2::4": 1,
    "phase3.html::p3-pytorch-distributed::FSDP2::5": 1,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh::0": 3,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh::1": 3,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh::2": 3,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh::3": 2,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh::4": 1,
    "phase3.html::p3-pytorch-distributed::DTensor and DeviceMesh::5": 3,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism::0": 3,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism::1": 3,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism::2": 1,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism::3": 3,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism::4": 3,
    "phase3.html::p3-pytorch-distributed::Tensor parallel and 2D parallelism::5": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan::0": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan::1": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan::2": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan::3": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan::4": 1,
    "phase3.html::p3-pytorch-distributed::Read torchtitan::5": 3,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation::0": 3,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation::1": 1,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation::2": 2,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation::3": 3,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation::4": 3,
    "phase3.html::p3-pytorch-distributed::Activation checkpointing and gradient accumulation::5": 2,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8::0": 3,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8::1": 3,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8::2": 1,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8::3": 3,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8::4": 1,
    "phase3.html::p3-pytorch-distributed::bf16 and fp8::5": 1,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging::0": 2,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging::1": 1,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging::2": 2,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging::3": 1,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging::4": 1,
    "phase3.html::p3-pytorch-distributed::NCCL and OOM debugging::5": 3,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume::0": 1,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume::1": 2,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume::2": 3,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume::3": 3,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume::4": 2,
    "phase3.html::p3-pytorch-distributed::Distributed checkpoint and resume::5": 1,
    "phase3.html::p3-cs336-systems::Watch the systems lectures::0": 1,
    "phase3.html::p3-cs336-systems::Watch the systems lectures::1": 1,
    "phase3.html::p3-cs336-systems::Watch the systems lectures::2": 1,
    "phase3.html::p3-cs336-systems::Watch the systems lectures::3": 2,
    "phase3.html::p3-cs336-systems::Watch the systems lectures::4": 1,
    "phase3.html::p3-cs336-systems::Watch the systems lectures::5": 3,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising::0": 3,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising::1": 2,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising::2": 3,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising::3": 3,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising::4": 1,
    "phase3.html::p3-cs336-systems::Benchmark and profile before optimising::5": 3,
    "phase3.html::p3-cs336-systems::Triton fundamentals::0": 1,
    "phase3.html::p3-cs336-systems::Triton fundamentals::1": 3,
    "phase3.html::p3-cs336-systems::Triton fundamentals::2": 1,
    "phase3.html::p3-cs336-systems::Triton fundamentals::3": 3,
    "phase3.html::p3-cs336-systems::Triton fundamentals::4": 1,
    "phase3.html::p3-cs336-systems::Triton fundamentals::5": 1,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton::0": 3,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton::1": 3,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton::2": 1,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton::3": 3,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton::4": 3,
    "phase3.html::p3-cs336-systems::FlashAttention-2 forward and backward in Triton::5": 3,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding::0": 1,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding::1": 3,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding::2": 3,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding::3": 3,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding::4": 3,
    "phase3.html::p3-cs336-systems::DDP from scratch, then optimizer state sharding::5": 3,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving::0": 1,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving::1": 2,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving::2": 3,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving::3": 1,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving::4": 1,
    "phase3.html::p3-serving-performance::Tensor-parallel and multi-GPU serving::5": 1,
    "phase3.html::p3-serving-performance::Quantization::0": 3,
    "phase3.html::p3-serving-performance::Quantization::1": 1,
    "phase3.html::p3-serving-performance::Quantization::2": 1,
    "phase3.html::p3-serving-performance::Quantization::3": 1,
    "phase3.html::p3-serving-performance::Quantization::4": 1,
    "phase3.html::p3-serving-performance::Quantization::5": 3,
    "phase3.html::p3-serving-performance::Speculative decoding::0": 1,
    "phase3.html::p3-serving-performance::Speculative decoding::1": 3,
    "phase3.html::p3-serving-performance::Speculative decoding::2": 3,
    "phase3.html::p3-serving-performance::Speculative decoding::3": 2,
    "phase3.html::p3-serving-performance::Speculative decoding::4": 1,
    "phase3.html::p3-serving-performance::Speculative decoding::5": 3,
    "phase3.html::p3-serving-performance::SGLang and structured generation::0": 1,
    "phase3.html::p3-serving-performance::SGLang and structured generation::1": 1,
    "phase3.html::p3-serving-performance::SGLang and structured generation::2": 2,
    "phase3.html::p3-serving-performance::SGLang and structured generation::3": 3,
    "phase3.html::p3-serving-performance::SGLang and structured generation::4": 3,
    "phase3.html::p3-serving-performance::SGLang and structured generation::5": 3,
    "phase4.html::p4-environment-harden::Re-measure it — eleven weeks have passed::0": 1,
    "phase4.html::p4-environment-harden::Re-measure it — eleven weeks have passed::1": 1,
    "phase4.html::p4-environment-harden::Re-measure it — eleven weeks have passed::2": 1,
    "phase4.html::p4-environment-harden::Re-measure it — eleven weeks have passed::3": 2,
    "phase4.html::p4-environment-harden::Re-measure it — eleven weeks have passed::4": 3,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control::0": 3,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control::1": 2,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control::2": 1,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control::3": 3,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control::4": 1,
    "phase4.html::p4-environment-harden::Kill the nondeterminism you control::5": 3,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it::0": 1,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it::1": 3,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it::2": 2,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it::3": 2,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it::4": 2,
    "phase4.html::p4-environment-harden::Get a stranger to install it and use it::5": 2,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty::0": 1,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty::1": 1,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty::2": 3,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty::3": 3,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty::4": 3,
    "phase4.html::p4-environment-harden::Claim a Prime Intellect environments bounty::5": 1,
    "phase4.html::p4-writeup::The technical report — not a preprint::0": 3,
    "phase4.html::p4-writeup::The technical report — not a preprint::1": 1,
    "phase4.html::p4-writeup::The technical report — not a preprint::2": 1,
    "phase4.html::p4-writeup::The technical report — not a preprint::3": 1,
    "phase4.html::p4-writeup::The technical report — not a preprint::4": 3,
    "phase4.html::p4-writeup::The technical report — not a preprint::5": 1,
    "phase4.html::p4-writeup::The README that does the actual work::0": 3,
    "phase4.html::p4-writeup::The README that does the actual work::1": 2,
    "phase4.html::p4-writeup::The README that does the actual work::2": 2,
    "phase4.html::p4-writeup::The README that does the actual work::3": 1,
    "phase4.html::p4-writeup::The README that does the actual work::4": 1,
    "phase4.html::p4-writeup::The README that does the actual work::5": 1,
    "phase4.html::p4-writeup::One blog post with a point of view::0": 3,
    "phase4.html::p4-writeup::One blog post with a point of view::1": 1,
    "phase4.html::p4-writeup::One blog post with a point of view::2": 3,
    "phase4.html::p4-writeup::One blog post with a point of view::3": 3,
    "phase4.html::p4-writeup::One blog post with a point of view::4": 2,
    "phase4.html::p4-writeup::One blog post with a point of view::5": 3,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4::0": 2,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4::1": 2,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4::2": 2,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4::3": 3,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4::4": 2,
    "phase4.html::p4-opensource::Land the contribution you have been building toward since week 4::5": 1,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count::0": 1,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count::1": 1,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count::2": 1,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count::3": 1,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count::4": 3,
    "phase4.html::p4-opensource::Pick the repo by who reads it, not by issue count::5": 1,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub::0": 3,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub::1": 1,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub::2": 1,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub::3": 2,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub::4": 2,
    "phase4.html::p4-opensource::Publish the environment to the Environments Hub::5": 1,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20::0": 3,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20::1": 3,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20::2": 2,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20::3": 3,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20::4": 3,
    "phase4.html::p4-apply::Audit the funnel you opened in week 20::5": 1,
    "phase4.html::p4-apply::Structured programs are the real funnel::0": 1,
    "phase4.html::p4-apply::Structured programs are the real funnel::1": 1,
    "phase4.html::p4-apply::Structured programs are the real funnel::2": 3,
    "phase4.html::p4-apply::Structured programs are the real funnel::3": 3,
    "phase4.html::p4-apply::Structured programs are the real funnel::4": 1,
    "phase4.html::p4-apply::Structured programs are the real funnel::5": 3,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level::0": 1,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level::1": 3,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level::2": 1,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level::3": 3,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level::4": 1,
    "phase4.html::p4-apply::Apply to the adjacent employers who hire at this level::5": 1,
    "phase4.html::p4-apply::Send the version that leads with reliability::0": 3,
    "phase4.html::p4-apply::Send the version that leads with reliability::1": 1,
    "phase4.html::p4-apply::Send the version that leads with reliability::2": 3,
    "phase4.html::p4-apply::Send the version that leads with reliability::3": 1,
    "phase4.html::p4-apply::Send the version that leads with reliability::4": 1,
    "phase4.html::p4-apply::Send the version that leads with reliability::5": 1
  }
};

const STORE_KEY = 'flp_progress';

// ── Persistence & Migration ───────────────────────────────────
function loadProgress() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORE_KEY));
  } catch (e) {}

  if (!raw) {
    return { completions: {} };
  }

  if (raw.completions) {
    return { completions: raw.completions };
  }

  return raw;
}

function saveProgress(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ completions: data.completions || {} }));
}

function migrateLegacyProgress(legacy, db) {
  const progress = { completions: {} };
  
  if (!legacy || Object.keys(legacy).length === 0) {
    return progress;
  }

  const completionsSrc = legacy.completions || legacy;

  for (const [taskId, value] of Object.entries(completionsSrc)) {
    if (value === true) {
      const page = getPageForTask(taskId);
      const taskResources = db[page]?.[taskId];
      const subtaskTitles = taskResources ? Object.keys(taskResources) : [];

      if (subtaskTitles.length > 0) {
        subtaskTitles.forEach(subtaskTitle => {
          const steps = taskResources[subtaskTitle].steps || [];
          if (steps.length > 0) {
            steps.forEach((_, idx) => {
              const stepKey = getStepKey(taskId, subtaskTitle, idx);
              progress.completions[stepKey] = true;
            });
          } else {
            const subtaskKey = getSubtaskKey(taskId, subtaskTitle);
            progress.completions[subtaskKey] = true;
          }
        });
      } else {
        progress.completions[taskId] = true;
      }
    }
  }
  return progress;
}

// ── Progress Key Helpers ─────────────────────────────────────
function getStepKey(taskId, subtaskTitle, stepIdx) {
  const page = getPageForTask(taskId);
  return `${page}::${taskId}::${subtaskTitle}::${stepIdx}`;
}

function getSubtaskKey(taskId, subtaskTitle) {
  const page = getPageForTask(taskId);
  return `${page}::${taskId}::${subtaskTitle}`;
}

function getTaskKey(taskId) {
  return `task::${taskId}`;
}

function getPhaseKey(phaseId) {
  return `phase::${phaseId}`;
}

// ── Static Weights Helpers ────────────────────────────────────
function getStaticStepWeight(page, taskId, subtaskTitle, stepIdx) {
  const key = `${page}::${taskId}::${subtaskTitle}::${stepIdx}`;
  if (STATIC_WEIGHTS.steps[key] !== undefined) {
    return STATIC_WEIGHTS.steps[key];
  }
  return 1;
}

function getStaticSubtaskWeight(page, taskId, subtaskTitle) {
  const key = `${page}::${taskId}::${subtaskTitle}`;
  if (STATIC_WEIGHTS.subtasks[key] !== undefined) {
    return STATIC_WEIGHTS.subtasks[key];
  }
  return 1;
}

function getStaticTaskWeight(taskId) {
  if (STATIC_WEIGHTS.tasks[taskId] !== undefined) {
    return STATIC_WEIGHTS.tasks[taskId];
  }
  return 1;
}

function getStaticPhaseWeight(phaseId) {
  if (STATIC_WEIGHTS.phases[phaseId] !== undefined) {
    return STATIC_WEIGHTS.phases[phaseId];
  }
  return 1;
}

// Helper to get step completion
function getStepCompletion(progressData, page, taskId, subtaskTitle, stepIdx, hasSteps) {
  if (!progressData.completions) progressData.completions = {};
  if (hasSteps) {
    const key = `${page}::${taskId}::${subtaskTitle}::${stepIdx}`;
    return !!progressData.completions[key];
  } else {
    const key = `${page}::${taskId}::${subtaskTitle}`;
    return !!progressData.completions[key];
  }
}

// ── Core Progress Calculation Engine (Weighted Bubble-up) ─────
function recalculateAllProgress(progressData) {
  if (!progressData.completions) progressData.completions = {};

  const db = window.RESOURCES_DB || {};
  const calculated = {
    subtasks: {}, // key -> percentage
    tasks: {},    // taskId -> percentage
    phases: {},   // phaseId -> percentage
    overall: 0
  };

  let overallWeightedSum = 0;
  let overallWeightTotal = 0;

  for (const [phaseId, phaseInfo] of Object.entries(ALL_PHASES)) {
    const page = phaseInfo.page;
    let phaseWeightedSum = 0;
    let phaseWeightTotal = 0;

    for (const taskId of phaseInfo.tasks) {
      let taskWeightedSum = 0;
      let taskWeightTotal = 0;

      const taskResources = db[page]?.[taskId];
      const subtaskTitles = taskResources ? Object.keys(taskResources) : [];

      if (subtaskTitles.length > 0) {
        // Complex task with subtasks
        for (const subtaskTitle of subtaskTitles) {
          const subtaskResources = taskResources[subtaskTitle];
          const steps = subtaskResources.steps || [];
          const hasSteps = steps.length > 0;

          let subtaskWeightedSum = 0;
          let subtaskWeightTotal = 0;

          if (hasSteps) {
            steps.forEach((_, idx) => {
              const done = getStepCompletion(progressData, page, taskId, subtaskTitle, idx, true);
              const w = getStaticStepWeight(page, taskId, subtaskTitle, idx);
              subtaskWeightedSum += (done ? 1 : 0) * w;
              subtaskWeightTotal += w;
            });
          } else {
            const done = getStepCompletion(progressData, page, taskId, subtaskTitle, 0, false);
            const w = getStaticSubtaskWeight(page, taskId, subtaskTitle);
            subtaskWeightedSum += (done ? 1 : 0) * w;
            subtaskWeightTotal += w;
          }

          const subtaskPct = subtaskWeightTotal > 0 ? (subtaskWeightedSum / subtaskWeightTotal) * 100 : 0;
          const subtaskKey = `${page}::${taskId}::${subtaskTitle}`;
          calculated.subtasks[subtaskKey] = subtaskPct;

          // Add to Task sum
          const subtaskW = getStaticSubtaskWeight(page, taskId, subtaskTitle);
          taskWeightedSum += subtaskPct * subtaskW;
          taskWeightTotal += subtaskW;
        }
      } else {
        // Simple task (e.g. Milestone)
        const done = !!progressData.completions[taskId];
        const taskPct = done ? 100 : 0;
        
        taskWeightedSum += taskPct * 1;
        taskWeightTotal += 1;
      }

      const taskPct = taskWeightTotal > 0 ? (taskWeightedSum / taskWeightTotal) : 0;
      calculated.tasks[taskId] = taskPct;

      // Add to Phase sum
      const taskW = getStaticTaskWeight(taskId);
      phaseWeightedSum += taskPct * taskW;
      phaseWeightTotal += taskW;
    }

    const phasePct = phaseWeightTotal > 0 ? (phaseWeightedSum / phaseWeightTotal) : 0;
    calculated.phases[phaseId] = phasePct;

    // Add to Overall sum
    const phaseW = getStaticPhaseWeight(phaseId);
    overallWeightedSum += phasePct * phaseW;
    overallWeightTotal += phaseW;
  }

  calculated.overall = overallWeightTotal > 0 ? (overallWeightedSum / overallWeightTotal) : 0;
  return calculated;
}

// ── Bulk Toggling ────────────────────────────────────────────
function toggleTaskChildren(taskId, checked) {
  const progressData = loadProgress();
  const db = window.RESOURCES_DB || {};
  const page = getPageForTask(taskId);
  
  const taskResources = db[page]?.[taskId];
  const subtaskTitles = taskResources ? Object.keys(taskResources) : [];
  
  if (subtaskTitles.length > 0) {
    subtaskTitles.forEach(subtaskTitle => {
      const steps = taskResources[subtaskTitle].steps || [];
      if (steps.length > 0) {
        steps.forEach((_, idx) => {
          const stepKey = getStepKey(taskId, subtaskTitle, idx);
          progressData.completions[stepKey] = checked;
        });
      } else {
        const subtaskKey = getSubtaskKey(taskId, subtaskTitle);
        progressData.completions[subtaskKey] = checked;
      }
    });
  } else {
    progressData.completions[taskId] = checked;
  }
  
  saveProgress(progressData);
  const calc = recalculateAllProgress(progressData);
  updatePageUI(calc, progressData);
  broadcastProgress();
  
  // Refresh sidebar if currently open on a subtask in this task
  const sidebar = document.getElementById('resources-sidebar');
  if (sidebar && sidebar.classList.contains('active')) {
    const titleEl = document.getElementById('sidebar-title');
    const subtaskTitle = titleEl ? titleEl.textContent.trim().split('\n')[0] : '';
    if (subtaskTitle) {
      openSidebar(taskId, subtaskTitle);
    }
  }
}

// ── Checkbox & State Styles ──────────────────────────────────
function updateDayState(cb) {
  const section = cb.closest('.day-section');
  if (!section) return;
  const label = cb.closest('.day-check');
  if (label) {
    label.classList.toggle('done', cb.checked);
    label.classList.toggle('indeterminate', cb.indeterminate);
  }
  section.classList.toggle('is-done', cb.checked);
}

// Broadcast updates to other pages/tabs
function broadcastProgress() {
  try { localStorage.setItem('flp_tick', Date.now()); } catch {}
}

// ── Tab switching (JAX page) ──────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.week-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.week-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });
}

// ── SPA Routing ──────────────────────────────────────────────
function handleRouting() {
  const hash = window.location.hash || '#overview';
  const activeViewId = 'view-' + hash.replace('#', '');
  
  // Toggle view panels
  const views = document.querySelectorAll('.view-panel');
  views.forEach(v => {
    if (v.id === activeViewId) {
      v.classList.add('active');
    } else {
      v.classList.remove('active');
    }
  });

  // Toggle nav active state
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === hash || (hash === '#overview' && href === '#overview')) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });

  // Close sidebar on navigate
  closeSidebar();
  
  // Scroll to top
  window.scrollTo(0, 0);
}

// ── Reading Pane Sidebar ─────────────────────────────────────
function loadResourcesDB(callback) {
  if (window.RESOURCES_DB) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'resources_db.js';
  script.onload = callback;
  document.head.appendChild(script);
}

function injectSidebar() {
  if (document.getElementById('resources-sidebar')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const sidebar = document.createElement('div');
  sidebar.id = 'resources-sidebar';
  sidebar.className = 'resources-sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-title" id="sidebar-title">Task Resources</div>
      <button class="sidebar-close-btn" id="sidebar-close-btn">&times;</button>
    </div>
    <div class="sidebar-body" id="sidebar-body"></div>
  `;
  document.body.appendChild(sidebar);

  document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

function openSidebar(taskId, subtaskTitle) {
  const db = window.RESOURCES_DB;
  if (!db) return;

  const page = getPageForTask(taskId);
  const resources = db[page]?.[taskId]?.[subtaskTitle];
  const titleEl = document.getElementById('sidebar-title');
  const bodyEl = document.getElementById('sidebar-body');
  const progressData = loadProgress();

  const subtaskW = getStaticSubtaskWeight(page, taskId, subtaskTitle);

  // Render static subtask weight in sidebar header
  titleEl.innerHTML = `
    <div style="font-size:14px; margin-bottom:4px;">${subtaskTitle}</div>
    <div class="sidebar-subtask-weight">
      <span>Subtask Weight: ${subtaskW}</span>
    </div>
  `;

  if (!resources) {
    bodyEl.innerHTML = `
      <p class="sidebar-desc" style="color:var(--muted)">No custom resources registered for this subtask yet.</p>
    `;
  } else {
    let html = '';

    if (resources.desc) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Overview &amp; Goal</div>
          <p class="sidebar-desc">${resources.desc}</p>
        </div>
      `;
    }

    // Step-by-Step with checkboxes
    if (resources.steps && resources.steps.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Step-by-Step Guide</div>
          <ul class="sidebar-steps" style="list-style: none;">
            ${resources.steps.map((step, idx) => {
              const done = getStepCompletion(progressData, page, taskId, subtaskTitle, idx, true);
              const w = getStaticStepWeight(page, taskId, subtaskTitle, idx);
              return `
                <li class="sidebar-step-item">
                  <label class="step-check-label">
                    <input type="checkbox" class="step-checkbox" data-task-id="${taskId}" data-subtask-title="${subtaskTitle}" data-step-idx="${idx}" ${done ? 'checked' : ''}>
                    <span class="step-text">${step}</span>
                  </label>
                  <div class="weight-input-container" style="flex-shrink: 0; padding: 2px 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 2px;">
                    <span>w: ${w}</span>
                  </div>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `;
    } else {
      const done = getStepCompletion(progressData, page, taskId, subtaskTitle, 0, false);
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Status</div>
          <ul class="sidebar-steps" style="list-style: none;">
            <li class="sidebar-step-item">
              <label class="step-check-label">
                <input type="checkbox" class="step-checkbox" data-task-id="${taskId}" data-subtask-title="${subtaskTitle}" data-step-idx="-1" ${done ? 'checked' : ''}>
                <span class="step-text">Mark this subtask as completed</span>
              </label>
            </li>
          </ul>
        </div>
      `;
    }

    if (resources.courses && resources.courses.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Courses &amp; Tutorials</div>
          ${resources.courses.map(course => `
            <div class="sidebar-resource-card">
              <span class="resource-badge badge-course">Course</span>
              <div class="sidebar-resource-name">${course.name}</div>
              <a class="sidebar-resource-link" href="${course.url}" target="_blank">View Course ↗</a>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (resources.papers && resources.papers.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Research Papers &amp; Preprints</div>
          ${resources.papers.map(paper => `
            <div class="sidebar-resource-card">
              <span class="resource-badge badge-paper">Paper</span>
              <div class="sidebar-resource-name">${paper.name}</div>
              <a class="sidebar-resource-link" href="${paper.url}" target="_blank">Read Paper ↗</a>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (resources.lectures && resources.lectures.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Lecture Notes &amp; Slides</div>
          ${resources.lectures.map(lecture => `
            <div class="sidebar-resource-card">
              <span class="resource-badge badge-lecture">Lecture</span>
              <div class="sidebar-resource-name">${lecture.name}</div>
              <a class="sidebar-resource-link" href="${lecture.url}" target="_blank">Open Notes ↗</a>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (resources.docs && resources.docs.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Documentation &amp; Guides</div>
          ${resources.docs.map(doc => `
            <div class="sidebar-resource-card">
              <span class="resource-badge badge-doc">Doc</span>
              <div class="sidebar-resource-name">${doc.name}</div>
              <a class="sidebar-resource-link" href="${doc.url}" target="_blank">Open Reference ↗</a>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (resources.videos && resources.videos.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">YouTube Videos</div>
          ${resources.videos.map(vid => `
            <div class="sidebar-resource-card">
              <span class="resource-badge badge-video">Video</span>
              <div class="sidebar-resource-name">${vid.title}</div>
              <a class="sidebar-resource-link" href="${vid.url}" target="_blank">Watch Video ↗</a>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (resources.podcasts && resources.podcasts.length) {
      html += `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Podcasts &amp; Deep Dives</div>
          ${resources.podcasts.map(pod => `
            <div class="sidebar-resource-card">
              <span class="resource-badge badge-podcast">Podcast</span>
              <div class="sidebar-resource-name">${pod.title}</div>
              <a class="sidebar-resource-link" href="${pod.url}" target="_blank">Listen ↗</a>
            </div>
          `).join('')}
        </div>
      `;
    }

    bodyEl.innerHTML = html;
  }

  // Wire up checkbox event listeners inside sidebar
  bodyEl.querySelectorAll('.step-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const t = cb.dataset.taskId;
      const title = cb.dataset.subtaskTitle;
      const idx = parseInt(cb.dataset.stepIdx, 10);
      
      const pData = loadProgress();
      if (idx === -1) {
        const subtaskKey = getSubtaskKey(t, title);
        pData.completions[subtaskKey] = cb.checked;
      } else {
        const stepKey = getStepKey(t, title, idx);
        pData.completions[stepKey] = cb.checked;
      }
      saveProgress(pData);
      
      const calc = recalculateAllProgress(pData);
      updatePageUI(calc, pData);
      broadcastProgress();
    });
  });

  document.getElementById('sidebar-backdrop').classList.add('active');
  document.getElementById('resources-sidebar').classList.add('active');
}

function closeSidebar() {
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebar = document.getElementById('resources-sidebar');
  if (backdrop) backdrop.classList.remove('active');
  if (sidebar) sidebar.classList.remove('active');
}

function initSubtasks() {
  const taskItems = document.querySelectorAll('.task-item');

  taskItems.forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('a') || e.target.closest('input') || e.target.closest('weight-badge') || e.target.closest('progress-bar')) return;

      const titleEl = item.querySelector('.task-item-title');
      if (!titleEl) return;

      const title = titleEl.textContent.trim();
      const section = item.closest('.day-section');
      const checkbox = section ? section.querySelector('input[type=checkbox]') : null;
      const taskId = checkbox ? checkbox.dataset.id : '';

      openSidebar(taskId, title);
    });
  });
}

// ── Dynamic UI Rendering ─────────────────────────────────────
function updatePageUI(calculated, progressData) {
  // ── 1. Global / Overview Updates ──
  Object.keys(ALL_PHASES).forEach(ph => {
    const pct = Math.round(calculated.phases[ph] || 0);

    document.querySelectorAll(`[data-phase-fill="${ph}"]`).forEach(f => {
      f.setAttribute('value', pct);
    });

    document.querySelectorAll(`[data-phase-count="${ph}"]`).forEach(c => {
      c.innerHTML = `${pct}% complete`;
    });
  });

  const pctAll = Math.round(calculated.overall || 0);
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  const completedTasksCount = Object.keys(ALL_PHASES)
    .flatMap(ph => ALL_PHASES[ph].tasks)
    .filter(taskId => Math.round(calculated.tasks[taskId] || 0) === 100).length;

  const totalTasksCount = Object.keys(ALL_PHASES)
    .flatMap(ph => ALL_PHASES[ph].tasks).length;

  set('global-done', completedTasksCount);
  set('global-done-2', completedTasksCount);
  set('global-total', totalTasksCount);
  set('global-pct', pctAll);
  set('global-pct-2', pctAll + '%');

  const fill = document.getElementById('global-bar-fill');
  if (fill) fill.setAttribute('value', pctAll);

  const started = Object.keys(ALL_PHASES)
    .filter(ph => (calculated.phases[ph] || 0) > 0).length;
  set('phases-started', started);

  // ── 2. Phase-Specific Progress Headers ──
  Object.keys(ALL_PHASES).forEach(ph => {
    const pagePct = Math.round(calculated.phases[ph] || 0);
    const fill = document.getElementById(`progress-bar-${ph}`);
    if (fill) fill.setAttribute('value', pagePct);

    const label = document.getElementById(`progress-label-${ph}`);
    if (label) {
      label.textContent = pagePct + '% complete';
    }
  });

  // ── 3. Tasks and Subtasks Rendering ──
  const db = window.RESOURCES_DB || {};
  
  for (const [phaseId, phaseInfo] of Object.entries(ALL_PHASES)) {
    const page = phaseInfo.page;
    const taskIds = phaseInfo.tasks;

    taskIds.forEach(taskId => {
      const taskPct = calculated.tasks[taskId] || 0;
      const cb = document.querySelector(`input[type="checkbox"][data-id="${taskId}"]`);
      if (cb) {
        cb.checked = (taskPct === 100);
        cb.indeterminate = (taskPct > 0 && taskPct < 100);
        updateDayState(cb);
      }

      const pctBadge = document.getElementById(`task-pct-${taskId}`);
      if (pctBadge) {
        pctBadge.textContent = Math.round(taskPct) + '%';
      }

      const taskResources = db[page]?.[taskId];
      const subtaskTitles = taskResources ? Object.keys(taskResources) : [];

      subtaskTitles.forEach(subtaskTitle => {
        const subtaskKey = `${page}::${taskId}::${subtaskTitle}`;
        const subtaskPct = calculated.subtasks[subtaskKey] || 0;

        const cardFill = document.getElementById(`subtask-fill-${subtaskKey}`);
        if (cardFill) {
          cardFill.setAttribute('value', Math.round(subtaskPct));
        }

        const cardPctBadge = document.getElementById(`subtask-pct-badge-${subtaskKey}`);
        if (cardPctBadge) {
          cardPctBadge.textContent = Math.round(subtaskPct) + '%';
        }
      });
    });
  }
}

// ── Application Initialization ───────────────────────────────
function initApp() {
  let progressData = loadProgress();

  // Migrate legacy data if necessary
  if (!progressData.completions) {
    progressData = migrateLegacyProgress(progressData, window.RESOURCES_DB || {});
    saveProgress(progressData);
  }

  // ── 1. Phase Weight Badges on Overview Phase Cards ──
  const phaseCards = document.querySelectorAll('.phase-card');
  phaseCards.forEach(card => {
    const href = card.getAttribute('href');
    const ph = href.replace('#', '');
    if (!ALL_PHASES[ph]) return;

    if (!card.querySelector('.phase-weight-container')) {
      const container = document.createElement('div');
      container.className = 'phase-weight-container';
      
      const w = getStaticPhaseWeight(ph);
      container.innerHTML = `
        <span>Phase Weight: ${w}</span>
      `;
      const inner = card.querySelector('.phase-card-inner');
      if (inner) inner.appendChild(container);
    }
  });

  // ── 2. Task Headers & Subtask Cards Injections (All Phases) ──
  const db = window.RESOURCES_DB || {};
  const daySections = document.querySelectorAll('.day-section');

  daySections.forEach(section => {
    const cb = section.querySelector('input[type="checkbox"][data-id]');
    if (!cb) return;
    const taskId = cb.dataset.id;
    const page = getPageForTask(taskId);

    // Inject Task Header Controls
    const dayHeader = section.querySelector('.day-header');
    if (dayHeader && !dayHeader.querySelector('.task-header-controls')) {
      const dayCheck = dayHeader.querySelector('.day-check');
      
      const controls = document.createElement('div');
      controls.className = 'task-header-controls';
      
      const pctBadge = document.createElement('span');
      pctBadge.className = 'task-pct-badge';
      pctBadge.id = `task-pct-${taskId}`;
      pctBadge.textContent = '0%';
      controls.appendChild(pctBadge);

      const w = getStaticTaskWeight(taskId);
      const wBadge = document.createElement('span');
      wBadge.className = 'task-pct-badge';
      wBadge.style.background = 'rgba(255,255,255,0.05)';
      wBadge.style.borderColor = 'var(--border)';
      wBadge.style.color = 'var(--muted2)';
      wBadge.textContent = `w: ${w}`;
      controls.appendChild(wBadge);

      dayHeader.insertBefore(controls, dayCheck);
    }

    // Inject Subtask Card Controls & Progress Web Components
    const taskItems = section.querySelectorAll('.task-item');
    taskItems.forEach(item => {
      const titleEl = item.querySelector('.task-item-title');
      if (!titleEl) return;
      const subtaskTitle = titleEl.textContent.trim();
      const subtaskKey = `${page}::${taskId}::${subtaskTitle}`;

      if (!item.querySelector('.subtask-meta')) {
        const subtaskW = getStaticSubtaskWeight(page, taskId, subtaskTitle);
        
        const meta = document.createElement('div');
        meta.className = 'subtask-meta';
        meta.innerHTML = `
          <weight-badge value="${subtaskW}"></weight-badge>
          <span class="subtask-progress-badge" id="subtask-pct-badge-${subtaskKey}">0%</span>
        `;
        
        const progressBar = document.createElement('progress-bar');
        progressBar.id = `subtask-fill-${subtaskKey}`;
        progressBar.setAttribute('value', '0');
        progressBar.style.marginTop = '6px';
        
        item.appendChild(meta);
        item.appendChild(progressBar);
      }
    });
  });

  // Wire up task checkbox toggle (bulk select/deselect)
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
    const newCb = cb.cloneNode(true);
    cb.parentNode.replaceChild(newCb, cb);
    newCb.addEventListener('change', () => {
      toggleTaskChildren(newCb.dataset.id, newCb.checked);
    });
  });

  // Initial Calculation & Update
  const calc = recalculateAllProgress(progressData);
  updatePageUI(calc, progressData);
}

// ── Bootstrapping ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadResourcesDB(() => {
    initApp();
    if (document.querySelector('.week-tab')) initTabs();
    injectSidebar();
    initSubtasks();
    
    // Wire up SPA Routing
    window.addEventListener('hashchange', handleRouting);
    handleRouting();
  });
});

window.addEventListener('storage', e => {
  if (e.key === 'flp_tick' || e.key === 'flp_progress') {
    const progressData = loadProgress();
    const calc = recalculateAllProgress(progressData);
    updatePageUI(calc, progressData);
  }
});
