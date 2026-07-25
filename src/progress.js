/**
 * Completion state and the Covered rollup.
 *
 * Progress is a set of done node ids — presence, not flags — matching how the
 * database stores it. A step id is present when that step is done; for a
 * subtask with no steps, the subtask's own id stands in; for a milestone,
 * which has no subtasks at all, the task's own id does.
 */
import { API } from './api.js';

let done = new Set();

export function setProgressState(nodeIds) {
  done = new Set(nodeIds);
}

export function isDone(nodeId) {
  return done.has(nodeId);
}

export function allDone() {
  return done;
}

export async function toggle(pathId, nodeId, want) {
  if (want) done.add(nodeId); else done.delete(nodeId);
  await API.setProgress(pathId, nodeId, want);
}

/**
 * Hierarchical, normalising at every level: steps into a subtask, subtasks
 * into a task, tasks into a phase, phases into the overall number. Retained
 * must use this same shape — a flat weighted mean over subtasks reads higher
 * than Covered and makes the pair meaningless.
 */
export function rollup(path, weights, doneSet) {
  const out = { subtasks: {}, tasks: {}, phases: {}, overall: 0 };
  let overallSum = 0, overallTotal = 0;

  for (const ph of path.phases ?? []) {
    let phaseSum = 0, phaseTotal = 0;

    for (const t of ph.tasks ?? []) {
      const subs = t.subtasks ?? [];
      let taskPct;

      if (subs.length === 0) {
        // A milestone. Without this branch its weight would sit in the
        // denominator unsatisfiable, capping the plan below 100 forever.
        taskPct = doneSet.has(t.id) ? 100 : 0;
      } else {
        let taskSum = 0, taskTotal = 0;

        for (const s of subs) {
          const steps = s.steps ?? [];
          let sSum = 0, sTotal = 0;

          if (steps.length) {
            for (const st of steps) {
              const w = weights.steps[st.id] ?? 1;
              sSum += (doneSet.has(st.id) ? 1 : 0) * w;
              sTotal += w;
            }
          } else {
            sSum = doneSet.has(s.id) ? 1 : 0;
            sTotal = 1;
          }

          const pct = sTotal > 0 ? (sSum / sTotal) * 100 : 0;
          out.subtasks[s.id] = pct;

          const sw = weights.subtasks[s.id] ?? 1;
          taskSum += pct * sw;
          taskTotal += sw;
        }

        taskPct = taskTotal > 0 ? taskSum / taskTotal : 0;
      }

      out.tasks[t.id] = taskPct;

      const tw = weights.tasks[t.id] ?? 1;
      phaseSum += taskPct * tw;
      phaseTotal += tw;
    }

    const phasePct = phaseTotal > 0 ? phaseSum / phaseTotal : 0;
    out.phases[ph.id] = phasePct;

    const pw = weights.phases[ph.id] ?? 1;
    overallSum += phasePct * pw;
    overallTotal += pw;
  }

  out.overall = overallTotal > 0 ? overallSum / overallTotal : 0;
  return out;
}
