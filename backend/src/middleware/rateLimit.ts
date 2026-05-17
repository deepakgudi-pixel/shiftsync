const userRateLimit = (options: any = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    keyPrefix = "rl",
    skipRoles = [],
  } = options;
  const store = new Map<string, { ts: number; count: number }[]>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entries] of store) {
      const pruned = entries.filter((e) => now - e.ts < windowMs);
      if (pruned.length === 0) store.delete(key);
      else store.set(key, pruned);
    }
  }, windowMs);
  cleanup.unref();

  return (req: any, res: any, next: any) => {
    if (!req.member?.id) return next();
    if (skipRoles.includes(req.member.role)) return next();

    const key = `${keyPrefix}:${req.member.id}`;
    const now = Date.now();
    const entries = store.get(key) || [];
    const window = entries.filter((e) => now - e.ts < windowMs);
    const count = window.reduce((sum, e) => sum + e.count, 0);

    if (count >= max) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set({
        "Content-Type": "application/json",
        "Retry-After": retryAfter,
        "X-RateLimit-Limit": max,
        "X-RateLimit-Remaining": 0,
        "X-RateLimit-Reset": Math.ceil((now + windowMs) / 1000),
      });
      return res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfter,
      });
    }

    window.push({ ts: now, count: 1 });
    store.set(key, window);

    res.set({
      "X-RateLimit-Limit": max,
      "X-RateLimit-Remaining": Math.max(0, max - count - 1),
      "X-RateLimit-Reset": Math.ceil((now + windowMs) / 1000),
    });

    next();
  };
};

const authenticatedApiRateLimit = userRateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTHENTICATED_RATE_LIMIT_MAX || 1000),
  keyPrefix: "auth-api",
  skipRoles: ["ADMIN"],
});

module.exports = { authenticatedApiRateLimit, userRateLimit };
export {};
