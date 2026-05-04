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
  const progress = clamp(0.22, 0.22 + progressRatio * 0.72, 0.94);

  return {
    stage,
    progress: progress.toFixed(3),
    progressPosition: `${Math.round(progress * 100)}%`,
    sweepDuration: `${Math.round(2600 - energy * 620)}ms`,
    signalDuration: `${Math.round(1900 - energy * 420)}ms`,
    motionScale: (1 + energy * 0.025).toFixed(3),
  };
}
