export async function runWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  const workerCount = Math.min(list.length, Math.max(1, Math.floor(Number(limit) || 1)));
  const results = new Array(list.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < list.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(list[index], index);
      }
    }),
  );

  return results;
}
