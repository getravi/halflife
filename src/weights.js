/**
 * Weight derivation, moved out of tools/build.js. Phase and task weights are
 * authored; subtask and step weights are derived, so adding a step never
 * requires editing a weights file that can drift from the content it
 * describes.
 *
 * These regexes are carried over unchanged. A step that builds something
 * costs more than a step that reads something, and the progress bar should
 * say so.
 */
const BUILD = /\b(implement|build|write|derive|train|construct|create|port|rewrite|reproduce|fit|profile|benchmark|verify|prove|measure|publish|submit|ship|instrument|harden)\b/i;
const PRACTICE = /\b(practice|solve|work through|run|configure|set up|experiment|debug|trace|compare|classify|annotate|refactor|test|audit|inspect)\b/i;

export const stepWeight = text => (BUILD.test(text) ? 3 : PRACTICE.test(text) ? 2 : 1);

export function indexPath(path) {
  const phases = new Map(), tasks = new Map(), subtasks = new Map(), steps = new Map();
  const taskOf = new Map(), subtaskOf = new Map(), phaseOf = new Map();

  for (const ph of path.phases ?? []) {
    phases.set(ph.id, ph);
    for (const t of ph.tasks ?? []) {
      tasks.set(t.id, t);
      phaseOf.set(t.id, ph.id);
      for (const s of t.subtasks ?? []) {
        subtasks.set(s.id, s);
        taskOf.set(s.id, t.id);
        for (const st of s.steps ?? []) {
          steps.set(st.id, st);
          subtaskOf.set(st.id, s.id);
        }
      }
    }
  }
  return { phases, tasks, subtasks, steps, taskOf, subtaskOf, phaseOf };
}

export function computeWeights(path) {
  const w = { phases: {}, tasks: {}, subtasks: {}, steps: {} };

  for (const ph of path.phases ?? []) {
    w.phases[ph.id] = ph.weight ?? 1;
    for (const t of ph.tasks ?? []) {
      w.tasks[t.id] = t.weight ?? 1;
      const subs = t.subtasks ?? [];
      // A milestone has no subtasks; dividing by zero here would poison every
      // weight above it with NaN.
      const each = subs.length ? (t.weight ?? 1) / subs.length : 0;
      for (const s of subs) {
        w.subtasks[s.id] = each;
        for (const st of s.steps ?? []) w.steps[st.id] = stepWeight(st.text);
      }
    }
  }
  return w;
}
