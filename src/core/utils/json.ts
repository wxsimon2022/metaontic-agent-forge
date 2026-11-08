/** utils/json：从宿主入口拆出的独立职责模块。 */


/**
 * 宿主要求工具返回值是「无损 JSON」：只要出现 undefined、NaN/Infinity/-0、
 * 非纯对象（Error/Date 实例等）或循环引用，整条结果就会被丢弃并报
 * 「value is not lossless JSON」。这里统一清洗成严格 JSON。
 */
function toJsonSafe(value, seen = new Set()) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    return Number.isFinite(value) && !Object.is(value, -0) ? value : String(value);
  }
  if (type === 'bigint') return value.toString();
  if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return value.message ? `${value.name}: ${value.message}` : value.name;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (item) => toJsonSafe(item, seen) ?? null);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return String(value);
    const plain = {};
    for (const [key, item] of Object.entries(value)) {
      const safe = toJsonSafe(item, seen);
      if (safe !== undefined) plain[key] = safe;
    }
    return plain;
  } finally {
    seen.delete(value);
  }
}

/** 把工具 execute 的返回值清洗成宿主接受的无损 JSON，避免整条结果被丢弃。 */
export function jsonSafeTool(tool) {
  return {
    ...tool,
    async execute(...args) {
      return toJsonSafe(await tool.execute(...args));
    },
  };
}
