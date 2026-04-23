/**
 * 通用批量执行工具
 * 控制并发数，支持进度回调
 */

/**
 * 分批执行异步任务，控制并发数
 * @param items 待处理的项目列表
 * @param batchSize 每批并发数
 * @param fn 单项处理函数
 * @param options 可选配置
 * @returns 按原始顺序返回所有结果（Promise.allSettled 格式）
 */
export async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>,
  options?: {
    /** 批次间延迟 (ms) */
    delayMs?: number;
    /** 进度回调 */
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<PromiseSettledResult<R>[]> {
  const { delayMs = 0, onProgress } = options ?? {};
  const results: PromiseSettledResult<R>[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    // 批次间延迟
    if (i > 0 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((item, batchIdx) => fn(item, i + batchIdx))
    );

    for (const br of batchResults) {
      completed++;
      onProgress?.(completed, items.length);
      results.push(br);
    }
  }

  return results;
}
