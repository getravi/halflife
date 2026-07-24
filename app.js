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
    tasks: ['p0-python-basics', 'p0-python-fluency', 'p0-numpy', 'p0-algorithms', 'p0-git-tooling', 'p0-math-refresh', 'p0-milestone']
  },
  p1: {
    page: 'phase1.html',
    tasks: ['p1-karpathy-hero', 'p1-transformer-pytorch', 'p1-cs336-basics', 'p1-nanochat', 'p1-huggingface-stack', 'p1-milestone']
  },
  p2: {
    page: 'phase2.html',
    tasks: ['jax-d1', 'jax-d2', 'jax-d3', 'jax-d4', 'jax-d5', 'jax-d6', 'jax-d7', 'jax-d8', 'jax-d9', 'jax-d10', 'p2-scaling-book', 'p2-scaling-laws', 'p2-milestone']
  },
  p3: {
    page: 'phase3.html',
    tasks: ['p3-finetuning', 'p3-rl-posttraining', 'p3-agent-eval', 'p3-lit-review', 'p3-milestone']
  },
  p4: {
    page: 'phase4.html',
    tasks: ['p4-capstone-project', 'p4-open-source', 'p4-cold-email', 'p4-milestone']
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
    p0: 8, p1: 12, p2: 10, p3: 16, p4: 14
  },
  tasks: {
    // Phase 0
    'p0-python-basics': 25, 'p0-python-fluency': 12, 'p0-numpy': 12, 'p0-algorithms': 10, 'p0-git-tooling': 10, 'p0-math-refresh': 26, 'p0-milestone': 5,
    // Phase 1
    'p1-karpathy-hero': 30, 'p1-transformer-pytorch': 22, 'p1-cs336-basics': 22, 'p1-nanochat': 22, 'p1-huggingface-stack': 12, 'p1-milestone': 10,
    // Phase 2
    'jax-d1': 2, 'jax-d2': 2, 'jax-d3': 2, 'jax-d4': 2, 'jax-d5': 3, 'jax-d6': 3, 'jax-d7': 3, 'jax-d8': 4, 'jax-d9': 3, 'jax-d10': 4, 'p2-scaling-book': 32, 'p2-scaling-laws': 24, 'p2-milestone': 15,
    // Phase 3
    'p3-finetuning': 22, 'p3-rl-posttraining': 28, 'p3-agent-eval': 45, 'p3-lit-review': 18, 'p3-milestone': 10,
    // Phase 4
    'p4-capstone-project': 60, 'p4-open-source': 25, 'p4-cold-email': 8, 'p4-milestone': 20
  },
  subtasks: {
    // Phase 0
    "phase0.html::p0-python-basics::Set up and write your first programs": 6,
    "phase0.html::p0-python-basics::Data structures and control flow": 6,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes": 6,
    "phase0.html::p0-python-basics::Exit check": 8,
    "phase0.html::p0-python-fluency::Refresh core Python": 4,
    "phase0.html::p0-python-fluency::Type annotations & tooling": 4,
    "phase0.html::p0-python-fluency::Exit check": 4,
    "phase0.html::p0-numpy::Think in arrays, not loops": 4,
    "phase0.html::p0-numpy::Matrix ops by hand": 4,
    "phase0.html::p0-numpy::Exit check": 4,
    "phase0.html::p0-algorithms::Complexity intuition": 5,
    "phase0.html::p0-algorithms::Optimizer math & 5 LeetCode": 5,
    "phase0.html::p0-git-tooling::Git fluency": 3,
    "phase0.html::p0-git-tooling::Workspace setup with 'uv'": 3,
    "phase0.html::p0-git-tooling::Profiling scripts": 3,
    "phase0.html::p0-math-refresh::Linear algebra warmup": 9,
    "phase0.html::p0-math-refresh::Calculus & MLP Backprop": 9,
    "phase0.html::p0-math-refresh::Probability & Entropy": 9,
    // Phase 1
    "phase1.html::p1-karpathy-hero::Build Micrograd": 15,
    "phase1.html::p1-karpathy-hero::Makemore Series": 15,
    "phase1.html::p1-transformer-pytorch::Read Attention Paper": 7,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer": 7,
    "phase1.html::p1-transformer-pytorch::Modern LLM internals": 7,
    "phase1.html::p1-cs336-basics::Watch the lectures": 11,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics": 11,
    "phase1.html::p1-nanochat::Read the whole repo": 6,
    "phase1.html::p1-nanochat::Run the speedrun": 6,
    "phase1.html::p1-nanochat::Change one thing and measure it": 11,
    "phase1.html::p1-huggingface-stack::Load Open Weights": 6,
    "phase1.html::p1-huggingface-stack::Generation parameters": 6,
    // Phase 2
    "phase2.html::jax-d1::Pure functions only": 1,
    "phase2.html::jax-d1::Tracing model": 1,
    "phase2.html::jax-d1::Cause the failure modes": 1,
    "phase2.html::jax-d2::jax.grad basics": 1,
    "phase2.html::jax-d2::jacfwd vs jacrev": 1,
    "phase2.html::jax-d2::Higher-order grads": 1,
    "phase2.html::jax-d3::When jit recompiles": 1,
    "phase2.html::jax-d3::Debugging inside jit": 1,
    "phase2.html::jax-d3::Benchmark jit speedup": 1,
    "phase2.html::jax-d4::vmap mental model": 1,
    "phase2.html::jax-d4::Practical vmap uses": 1,
    "phase2.html::jax-d4::Composing transforms": 1,
    "phase2.html::jax-d5::Manual training loop (no libraries)": 1,
    "phase2.html::jax-d5::Pytrees deep dive": 1,
    "phase2.html::jax-d5::PRNG key management": 1,
    "phase2.html::jax-d6::Flax NNX (current API)": 1,
    "phase2.html::jax-d6::Rebuild your MLP with Flax + Optax": 1,
    "phase2.html::jax-d6::Optax transform chains": 1,
    "phase2.html::jax-d7::lax.scan mental model": 1,
    "phase2.html::jax-d7::scan-based training loop": 1,
    "phase2.html::jax-d7::lax.cond and while_loop": 1,
    "phase2.html::jax-d8::Explicit sharding (the current default)": 1,
    "phase2.html::jax-d8::Collective ops (pmean, psum)": 1,
    "phase2.html::jax-d8::shard_map for manual control": 1,
    "phase2.html::jax-d9::Accelerator setup": 1,
    "phase2.html::jax-d9::GPU vs TPU differences": 1,
    "phase2.html::jax-d9::Port your MLP to all 8 devices": 1,
    "phase2.html::jax-d10::Transformer block from scratch": 1,
    "phase2.html::jax-d10::Basic JAX profiling": 1,
    "phase2.html::jax-d10::Start the scaling book": 1,
    "phase2.html::p2-scaling-book::Work the scaling book": 11,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook": 11,
    "phase2.html::p2-scaling-book::Record your solutions": 11,
    "phase2.html::p2-scaling-laws::Build JAX Transformer": 12,
    "phase2.html::p2-scaling-laws::Toy Scaling Experiments": 12,
    // Phase 3
    "phase3.html::p3-finetuning::LoRA from scratch": 11,
    "phase3.html::p3-finetuning::PEFT Pipeline with HF": 11,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop": 9,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly": 9,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number": 9,
    "phase3.html::p3-agent-eval::Survey evaluation tooling": 6,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark": 6,
    "phase3.html::p3-agent-eval::Design Controlled Experiment": 10,
    "phase3.html::p3-agent-eval::Failure mode analysis": 6,
    "phase3.html::p3-agent-eval::Build an environment": 16,
    "phase3.html::p3-lit-review::Vlad's Pretraining Lecture": 6,
    "phase3.html::p3-lit-review::Post-Training Literature": 6,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs": 6,
    // Phase 4
    "phase4.html::p4-capstone-project::Formalize your study": 30,
    "phase4.html::p4-capstone-project::Incorporate peer feedback": 30,
    "phase4.html::p4-open-source::Identify framework PRs": 12,
    "phase4.html::p4-open-source::Submit code & merge PR": 12,
    "phase4.html::p4-cold-email::Prepare the email": 8
  },
  steps: {
    "phase0.html::p0-python-basics::Set up and write your first programs::0": 1,
    "phase0.html::p0-python-basics::Set up and write your first programs::1": 3,
    "phase0.html::p0-python-basics::Set up and write your first programs::2": 3,
    "phase0.html::p0-python-basics::Set up and write your first programs::3": 2,
    "phase0.html::p0-python-basics::Set up and write your first programs::4": 1,
    "phase0.html::p0-python-basics::Set up and write your first programs::5": 3,
    "phase0.html::p0-python-basics::Data structures and control flow::0": 3,
    "phase0.html::p0-python-basics::Data structures and control flow::1": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::2": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::3": 1,
    "phase0.html::p0-python-basics::Data structures and control flow::4": 3,
    "phase0.html::p0-python-basics::Data structures and control flow::5": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::0": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::1": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::2": 3,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::3": 1,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::4": 1,
    "phase0.html::p0-python-basics::Functions, files, errors, and classes::5": 3,
    "phase0.html::p0-python-basics::Exit check::0": 1,
    "phase0.html::p0-python-basics::Exit check::1": 1,
    "phase0.html::p0-python-basics::Exit check::2": 1,
    "phase0.html::p0-python-basics::Exit check::3": 3,
    "phase0.html::p0-python-basics::Exit check::4": 3,
    "phase0.html::p0-python-basics::Exit check::5": 1,
    "phase0.html::p0-python-basics::Exit check::6": 1,
    "phase0.html::p0-python-fluency::Refresh core Python::0": 2,
    "phase0.html::p0-python-fluency::Refresh core Python::1": 1,
    "phase0.html::p0-python-fluency::Refresh core Python::2": 1,
    "phase0.html::p0-python-fluency::Refresh core Python::3": 2,
    "phase0.html::p0-python-fluency::Type annotations & tooling::0": 1,
    "phase0.html::p0-python-fluency::Type annotations & tooling::1": 2,
    "phase0.html::p0-python-fluency::Type annotations & tooling::2": 2,
    "phase0.html::p0-python-fluency::Type annotations & tooling::3": 1,
    "phase0.html::p0-python-fluency::Exit check::0": 3,
    "phase0.html::p0-python-fluency::Exit check::1": 1,
    "phase0.html::p0-python-fluency::Exit check::2": 1,
    "phase0.html::p0-python-fluency::Exit check::3": 3,
    "phase0.html::p0-numpy::Think in arrays, not loops::0": 2,
    "phase0.html::p0-numpy::Think in arrays, not loops::1": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::2": 1,
    "phase0.html::p0-numpy::Think in arrays, not loops::3": 1,
    "phase0.html::p0-numpy::Matrix ops by hand::0": 3,
    "phase0.html::p0-numpy::Matrix ops by hand::1": 3,
    "phase0.html::p0-numpy::Matrix ops by hand::2": 3,
    "phase0.html::p0-numpy::Exit check::0": 3,
    "phase0.html::p0-numpy::Exit check::1": 1,
    "phase0.html::p0-numpy::Exit check::2": 1,
    "phase0.html::p0-numpy::Exit check::3": 3,
    "phase0.html::p0-algorithms::Complexity intuition::0": 1,
    "phase0.html::p0-algorithms::Complexity intuition::1": 1,
    "phase0.html::p0-algorithms::Complexity intuition::2": 1,
    "phase0.html::p0-algorithms::Complexity intuition::3": 1,
    "phase0.html::p0-algorithms::Optimizer math & 5 LeetCode::0": 3,
    "phase0.html::p0-algorithms::Optimizer math & 5 LeetCode::1": 3,
    "phase0.html::p0-algorithms::Optimizer math & 5 LeetCode::2": 3,
    "phase0.html::p0-algorithms::Optimizer math & 5 LeetCode::3": 3,
    "phase0.html::p0-algorithms::Optimizer math & 5 LeetCode::4": 2,
    "phase0.html::p0-git-tooling::Git fluency::0": 1,
    "phase0.html::p0-git-tooling::Git fluency::1": 1,
    "phase0.html::p0-git-tooling::Git fluency::2": 1,
    "phase0.html::p0-git-tooling::Git fluency::3": 1,
    "phase0.html::p0-git-tooling::Workspace setup with 'uv'::0": 1,
    "phase0.html::p0-git-tooling::Workspace setup with 'uv'::1": 2,
    "phase0.html::p0-git-tooling::Workspace setup with 'uv'::2": 2,
    "phase0.html::p0-git-tooling::Profiling scripts::0": 3,
    "phase0.html::p0-git-tooling::Profiling scripts::1": 1,
    "phase0.html::p0-git-tooling::Profiling scripts::2": 1,
    "phase0.html::p0-git-tooling::Profiling scripts::3": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup::0": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup::1": 1,
    "phase0.html::p0-math-refresh::Linear algebra warmup::2": 2,
    "phase0.html::p0-math-refresh::Linear algebra warmup::3": 1,
    "phase0.html::p0-math-refresh::Calculus & MLP Backprop::0": 1,
    "phase0.html::p0-math-refresh::Calculus & MLP Backprop::1": 3,
    "phase0.html::p0-math-refresh::Calculus & MLP Backprop::2": 3,
    "phase0.html::p0-math-refresh::Calculus & MLP Backprop::3": 3,
    "phase0.html::p0-math-refresh::Probability & Entropy::0": 1,
    "phase0.html::p0-math-refresh::Probability & Entropy::1": 3,
    "phase0.html::p0-math-refresh::Probability & Entropy::2": 1,
    "phase1.html::p1-karpathy-hero::Build Micrograd::0": 1,
    "phase1.html::p1-karpathy-hero::Build Micrograd::1": 3,
    "phase1.html::p1-karpathy-hero::Build Micrograd::2": 3,
    "phase1.html::p1-karpathy-hero::Build Micrograd::3": 3,
    "phase1.html::p1-karpathy-hero::Makemore Series::0": 3,
    "phase1.html::p1-karpathy-hero::Makemore Series::1": 3,
    "phase1.html::p1-karpathy-hero::Makemore Series::2": 1,
    "phase1.html::p1-karpathy-hero::Makemore Series::3": 3,
    "phase1.html::p1-transformer-pytorch::Read Attention Paper::0": 1,
    "phase1.html::p1-transformer-pytorch::Read Attention Paper::1": 1,
    "phase1.html::p1-transformer-pytorch::Read Attention Paper::2": 1,
    "phase1.html::p1-transformer-pytorch::Read Attention Paper::3": 1,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::0": 3,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::1": 3,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::2": 3,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::3": 1,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::4": 3,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::5": 1,
    "phase1.html::p1-transformer-pytorch::Build a decoder-only transformer::6": 2,
    "phase1.html::p1-transformer-pytorch::Modern LLM internals::0": 1,
    "phase1.html::p1-transformer-pytorch::Modern LLM internals::1": 3,
    "phase1.html::p1-transformer-pytorch::Modern LLM internals::2": 1,
    "phase1.html::p1-transformer-pytorch::Modern LLM internals::3": 3,
    "phase1.html::p1-transformer-pytorch::Modern LLM internals::4": 3,
    "phase1.html::p1-cs336-basics::Watch the lectures::0": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures::1": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures::2": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures::3": 1,
    "phase1.html::p1-cs336-basics::Watch the lectures::4": 3,
    "phase1.html::p1-cs336-basics::Watch the lectures::5": 1,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::0": 2,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::1": 1,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::2": 3,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::3": 3,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::4": 3,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::5": 3,
    "phase1.html::p1-cs336-basics::Implement assignment1-basics::6": 2,
    "phase1.html::p1-nanochat::Read the whole repo::0": 1,
    "phase1.html::p1-nanochat::Read the whole repo::1": 3,
    "phase1.html::p1-nanochat::Read the whole repo::2": 1,
    "phase1.html::p1-nanochat::Read the whole repo::3": 2,
    "phase1.html::p1-nanochat::Read the whole repo::4": 1,
    "phase1.html::p1-nanochat::Read the whole repo::5": 1,
    "phase1.html::p1-nanochat::Read the whole repo::6": 1,
    "phase1.html::p1-nanochat::Run the speedrun::0": 1,
    "phase1.html::p1-nanochat::Run the speedrun::1": 2,
    "phase1.html::p1-nanochat::Run the speedrun::2": 3,
    "phase1.html::p1-nanochat::Run the speedrun::3": 1,
    "phase1.html::p1-nanochat::Run the speedrun::4": 1,
    "phase1.html::p1-nanochat::Run the speedrun::5": 3,
    "phase1.html::p1-nanochat::Run the speedrun::6": 2,
    "phase1.html::p1-nanochat::Change one thing and measure it::0": 3,
    "phase1.html::p1-nanochat::Change one thing and measure it::1": 1,
    "phase1.html::p1-nanochat::Change one thing and measure it::2": 2,
    "phase1.html::p1-nanochat::Change one thing and measure it::3": 2,
    "phase1.html::p1-nanochat::Change one thing and measure it::4": 1,
    "phase1.html::p1-nanochat::Change one thing and measure it::5": 3,
    "phase1.html::p1-nanochat::Change one thing and measure it::6": 3,
    "phase1.html::p1-huggingface-stack::Load Open Weights::0": 1,
    "phase1.html::p1-huggingface-stack::Load Open Weights::1": 1,
    "phase1.html::p1-huggingface-stack::Load Open Weights::2": 1,
    "phase1.html::p1-huggingface-stack::Load Open Weights::3": 2,
    "phase1.html::p1-huggingface-stack::Generation parameters::0": 1,
    "phase1.html::p1-huggingface-stack::Generation parameters::1": 1,
    "phase1.html::p1-huggingface-stack::Generation parameters::2": 3,
    "phase1.html::p1-huggingface-stack::Generation parameters::3": 2,
    "phase2.html::jax-d1::Pure functions only::0": 1,
    "phase2.html::jax-d1::Pure functions only::1": 3,
    "phase2.html::jax-d1::Pure functions only::2": 3,
    "phase2.html::jax-d1::Tracing model::0": 2,
    "phase2.html::jax-d1::Tracing model::1": 1,
    "phase2.html::jax-d1::Tracing model::2": 1,
    "phase2.html::jax-d1::Cause the failure modes::0": 1,
    "phase2.html::jax-d1::Cause the failure modes::1": 3,
    "phase2.html::jax-d1::Cause the failure modes::2": 1,
    "phase2.html::jax-d2::jax.grad basics::0": 1,
    "phase2.html::jax-d2::jax.grad basics::1": 1,
    "phase2.html::jax-d2::jax.grad basics::2": 1,
    "phase2.html::jax-d2::jacfwd vs jacrev::0": 1,
    "phase2.html::jax-d2::jacfwd vs jacrev::1": 3,
    "phase2.html::jax-d2::jacfwd vs jacrev::2": 3,
    "phase2.html::jax-d2::Higher-order grads::0": 1,
    "phase2.html::jax-d2::Higher-order grads::1": 3,
    "phase2.html::jax-d3::When jit recompiles::0": 3,
    "phase2.html::jax-d3::When jit recompiles::1": 1,
    "phase2.html::jax-d3::When jit recompiles::2": 1,
    "phase2.html::jax-d3::Debugging inside jit::0": 2,
    "phase2.html::jax-d3::Debugging inside jit::1": 2,
    "phase2.html::jax-d3::Benchmark jit speedup::0": 1,
    "phase2.html::jax-d3::Benchmark jit speedup::1": 3,
    "phase2.html::jax-d4::vmap mental model::0": 1,
    "phase2.html::jax-d4::vmap mental model::1": 1,
    "phase2.html::jax-d4::Practical vmap uses::0": 3,
    "phase2.html::jax-d4::Practical vmap uses::1": 1,
    "phase2.html::jax-d4::Composing transforms::0": 1,
    "phase2.html::jax-d4::Composing transforms::1": 2,
    "phase2.html::jax-d5::Manual training loop (no libraries)::0": 1,
    "phase2.html::jax-d5::Manual training loop (no libraries)::1": 3,
    "phase2.html::jax-d5::Manual training loop (no libraries)::2": 3,
    "phase2.html::jax-d5::Pytrees deep dive::0": 1,
    "phase2.html::jax-d5::Pytrees deep dive::1": 1,
    "phase2.html::jax-d5::PRNG key management::0": 1,
    "phase2.html::jax-d5::PRNG key management::1": 1,
    "phase2.html::jax-d6::Flax NNX (current API)::0": 1,
    "phase2.html::jax-d6::Flax NNX (current API)::1": 1,
    "phase2.html::jax-d6::Rebuild your MLP with Flax + Optax::0": 3,
    "phase2.html::jax-d6::Rebuild your MLP with Flax + Optax::1": 1,
    "phase2.html::jax-d6::Rebuild your MLP with Flax + Optax::2": 2,
    "phase2.html::jax-d6::Optax transform chains::0": 1,
    "phase2.html::jax-d6::Optax transform chains::1": 3,
    "phase2.html::jax-d7::lax.scan mental model::0": 1,
    "phase2.html::jax-d7::lax.scan mental model::1": 3,
    "phase2.html::jax-d7::scan-based training loop::0": 1,
    "phase2.html::jax-d7::scan-based training loop::1": 3,
    "phase2.html::jax-d7::lax.cond and while_loop::0": 1,
    "phase2.html::jax-d7::lax.cond and while_loop::1": 3,
    "phase2.html::jax-d7::lax.cond and while_loop::2": 3,
    "phase2.html::jax-d8::Explicit sharding (the current default)::0": 3,
    "phase2.html::jax-d8::Explicit sharding (the current default)::1": 1,
    "phase2.html::jax-d8::Explicit sharding (the current default)::2": 3,
    "phase2.html::jax-d8::Explicit sharding (the current default)::3": 1,
    "phase2.html::jax-d8::Explicit sharding (the current default)::4": 1,
    "phase2.html::jax-d8::Explicit sharding (the current default)::5": 1,
    "phase2.html::jax-d8::Collective ops (pmean, psum)::0": 3,
    "phase2.html::jax-d8::Collective ops (pmean, psum)::1": 1,
    "phase2.html::jax-d8::Collective ops (pmean, psum)::2": 1,
    "phase2.html::jax-d8::shard_map for manual control::0": 1,
    "phase2.html::jax-d8::shard_map for manual control::1": 3,
    "phase2.html::jax-d8::shard_map for manual control::2": 3,
    "phase2.html::jax-d8::shard_map for manual control::3": 1,
    "phase2.html::jax-d8::shard_map for manual control::4": 1,
    "phase2.html::jax-d8::shard_map for manual control::5": 3,
    "phase2.html::jax-d9::Accelerator setup::0": 1,
    "phase2.html::jax-d9::Accelerator setup::1": 1,
    "phase2.html::jax-d9::GPU vs TPU differences::0": 1,
    "phase2.html::jax-d9::GPU vs TPU differences::1": 1,
    "phase2.html::jax-d9::Port your MLP to all 8 devices::0": 1,
    "phase2.html::jax-d9::Port your MLP to all 8 devices::1": 1,
    "phase2.html::jax-d9::Port your MLP to all 8 devices::2": 2,
    "phase2.html::jax-d9::Port your MLP to all 8 devices::3": 1,
    "phase2.html::jax-d9::Port your MLP to all 8 devices::4": 3,
    "phase2.html::jax-d9::Port your MLP to all 8 devices::5": 3,
    "phase2.html::jax-d10::Transformer block from scratch::0": 3,
    "phase2.html::jax-d10::Transformer block from scratch::1": 1,
    "phase2.html::jax-d10::Basic JAX profiling::0": 1,
    "phase2.html::jax-d10::Basic JAX profiling::1": 1,
    "phase2.html::jax-d10::Start the scaling book::0": 1,
    "phase2.html::p2-scaling-book::Work the scaling book::0": 1,
    "phase2.html::p2-scaling-book::Work the scaling book::1": 2,
    "phase2.html::p2-scaling-book::Work the scaling book::2": 1,
    "phase2.html::p2-scaling-book::Work the scaling book::3": 1,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook::0": 3,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook::1": 1,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook::2": 2,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook::3": 1,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook::4": 2,
    "phase2.html::p2-scaling-book::GPUs and the Ultra-Scale Playbook::5": 1,
    "phase2.html::p2-scaling-book::Record your solutions::0": 1,
    "phase2.html::p2-scaling-book::Record your solutions::1": 1,
    "phase2.html::p2-scaling-book::Record your solutions::2": 1,
    "phase2.html::p2-scaling-laws::Build JAX Transformer::0": 3,
    "phase2.html::p2-scaling-laws::Build JAX Transformer::1": 3,
    "phase2.html::p2-scaling-laws::Build JAX Transformer::2": 2,
    "phase2.html::p2-scaling-laws::Build JAX Transformer::3": 2,
    "phase2.html::p2-scaling-laws::Toy Scaling Experiments::0": 2,
    "phase2.html::p2-scaling-laws::Toy Scaling Experiments::1": 3,
    "phase2.html::p2-scaling-laws::Toy Scaling Experiments::2": 3,
    "phase2.html::p2-scaling-laws::Toy Scaling Experiments::3": 2,
    "phase3.html::p3-finetuning::LoRA from scratch::0": 1,
    "phase3.html::p3-finetuning::LoRA from scratch::1": 3,
    "phase3.html::p3-finetuning::LoRA from scratch::2": 1,
    "phase3.html::p3-finetuning::LoRA from scratch::3": 3,
    "phase3.html::p3-finetuning::PEFT Pipeline with HF::0": 1,
    "phase3.html::p3-finetuning::PEFT Pipeline with HF::1": 1,
    "phase3.html::p3-finetuning::PEFT Pipeline with HF::2": 3,
    "phase3.html::p3-finetuning::PEFT Pipeline with HF::3": 2,
    "phase3.html::p3-finetuning::PEFT Pipeline with HF::4": 2,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop::0": 1,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop::1": 2,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop::2": 1,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop::3": 1,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop::4": 1,
    "phase3.html::p3-rl-posttraining::Run a GRPO-family training loop::5": 3,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly::0": 1,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly::1": 1,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly::2": 1,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly::3": 1,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly::4": 3,
    "phase3.html::p3-rl-posttraining::Read the RLVR debate honestly::5": 3,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number::0": 1,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number::1": 1,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number::2": 2,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number::3": 1,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number::4": 3,
    "phase3.html::p3-rl-posttraining::Learn what actually moves the number::5": 1,
    "phase3.html::p3-agent-eval::Survey evaluation tooling::0": 2,
    "phase3.html::p3-agent-eval::Survey evaluation tooling::1": 2,
    "phase3.html::p3-agent-eval::Survey evaluation tooling::2": 2,
    "phase3.html::p3-agent-eval::Survey evaluation tooling::3": 1,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark::0": 1,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark::1": 1,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark::2": 1,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark::3": 1,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark::4": 1,
    "phase3.html::p3-agent-eval::Learn to criticise a benchmark::5": 3,
    "phase3.html::p3-agent-eval::Design Controlled Experiment::0": 1,
    "phase3.html::p3-agent-eval::Design Controlled Experiment::1": 3,
    "phase3.html::p3-agent-eval::Design Controlled Experiment::2": 3,
    "phase3.html::p3-agent-eval::Design Controlled Experiment::3": 1,
    "phase3.html::p3-agent-eval::Design Controlled Experiment::4": 2,
    "phase3.html::p3-agent-eval::Failure mode analysis::0": 2,
    "phase3.html::p3-agent-eval::Failure mode analysis::1": 1,
    "phase3.html::p3-agent-eval::Failure mode analysis::2": 1,
    "phase3.html::p3-agent-eval::Failure mode analysis::3": 1,
    "phase3.html::p3-agent-eval::Failure mode analysis::4": 2,
    "phase3.html::p3-agent-eval::Build an environment::0": 3,
    "phase3.html::p3-agent-eval::Build an environment::1": 3,
    "phase3.html::p3-agent-eval::Build an environment::2": 2,
    "phase3.html::p3-agent-eval::Build an environment::3": 2,
    "phase3.html::p3-agent-eval::Build an environment::4": 3,
    "phase3.html::p3-agent-eval::Build an environment::5": 3,
    "phase3.html::p3-lit-review::Vlad's Pretraining Lecture::0": 1,
    "phase3.html::p3-lit-review::Vlad's Pretraining Lecture::1": 1,
    "phase3.html::p3-lit-review::Vlad's Pretraining Lecture::2": 1,
    "phase3.html::p3-lit-review::Post-Training Literature::0": 1,
    "phase3.html::p3-lit-review::Post-Training Literature::1": 1,
    "phase3.html::p3-lit-review::Post-Training Literature::2": 1,
    "phase3.html::p3-lit-review::Post-Training Literature::3": 3,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs::0": 3,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs::1": 1,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs::2": 1,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs::3": 1,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs::4": 1,
    "phase3.html::p3-lit-review::Reasoning, reward models & what replaced PRMs::5": 3,
    "phase4.html::p4-capstone-project::Formalize your study::0": 3,
    "phase4.html::p4-capstone-project::Formalize your study::1": 3,
    "phase4.html::p4-capstone-project::Formalize your study::2": 1,
    "phase4.html::p4-capstone-project::Formalize your study::3": 1,
    "phase4.html::p4-capstone-project::Incorporate peer feedback::0": 1,
    "phase4.html::p4-capstone-project::Incorporate peer feedback::1": 1,
    "phase4.html::p4-capstone-project::Incorporate peer feedback::2": 1,
    "phase4.html::p4-open-source::Identify framework PRs::0": 1,
    "phase4.html::p4-open-source::Identify framework PRs::1": 1,
    "phase4.html::p4-open-source::Identify framework PRs::2": 1,
    "phase4.html::p4-open-source::Submit code & merge PR::0": 2,
    "phase4.html::p4-open-source::Submit code & merge PR::1": 3,
    "phase4.html::p4-open-source::Submit code & merge PR::2": 1,
    "phase4.html::p4-cold-email::Prepare the email::0": 3,
    "phase4.html::p4-cold-email::Prepare the email::1": 2,
    "phase4.html::p4-cold-email::Prepare the email::2": 3,
    "phase4.html::p4-cold-email::Prepare the email::3": 2,
    "phase4.html::p4-cold-email::Prepare the email::4": 1
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
