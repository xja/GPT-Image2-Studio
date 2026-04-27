function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

export function shouldReusePreviewLoadingShell(previousState = {}, nextState = {}) {
  return previousState.mode === "loading" && nextState.mode === "loading";
}

export function getPreviewLoadingShellTheme(placeholderState = {}) {
  const stage = String(placeholderState.stage || "connecting");
  const progressRatio =
    placeholderState.stageCount > 1 ? placeholderState.stageIndex / (placeholderState.stageCount - 1) : 0;
  const countRatio =
    placeholderState.maxConcurrentTasks > 1
      ? (placeholderState.activeJobCount - 1) / (placeholderState.maxConcurrentTasks - 1)
      : 0;
  const energy = clamp(0, 0.16 + countRatio * 0.14 + progressRatio * 0.08, 0.42);

  return {
    stage,
    morphDurationA: `${Math.round(15000 - energy * 2200)}ms`,
    morphDurationB: `${Math.round(18600 - energy * 2400)}ms`,
    pulseDuration: `${Math.round(7600 - energy * 900)}ms`,
    driftDuration: `${Math.round(18000 - energy * 1800)}ms`,
    motionTilt: `${Math.round(-8 + progressRatio * 14 - countRatio * 4)}deg`,
    motionScale: (1 + energy * 0.06).toFixed(3),
  };
}
