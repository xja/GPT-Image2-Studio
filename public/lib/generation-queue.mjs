export function isQueuedGenerationJob(job) {
  return Boolean(job && !job.started && !job.isRunning);
}

export function cancelQueuedGenerationJob(jobs, jobId) {
  const id = String(jobId || "").trim();
  const jobList = Array.isArray(jobs) ? jobs : [];
  const target = jobList.find((job) => String(job?.id || "") === id);

  if (!target || !isQueuedGenerationJob(target)) {
    return {
      jobs: jobList,
      canceledJob: null,
    };
  }

  return {
    jobs: jobList.filter((job) => String(job?.id || "") !== id),
    canceledJob: target,
  };
}

export function selectNextQueuedGenerationJobs(jobs, availableSlots) {
  const slotCount = Math.max(0, Math.floor(Number(availableSlots) || 0));
  if (slotCount === 0) {
    return [];
  }

  const queuedJobs = (Array.isArray(jobs) ? jobs : []).filter(isQueuedGenerationJob);
  return queuedJobs.slice(Math.max(0, queuedJobs.length - slotCount)).reverse();
}
