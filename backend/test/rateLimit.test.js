const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const { userRateLimit } = require("../src/middleware/rateLimit");

const makeRequests = (app, path, count) => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const results = [];
      let completed = 0;

      const doRequest = (index) => {
        http.get(`http://localhost:${port}${path}`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            results[index] = {
              status: res.statusCode,
              headers: res.headers,
              body: JSON.parse(data),
            };
            completed++;
            if (completed === count) {
              server.close();
              resolve(results);
            }
          });
        }).on("error", (err) => {
          server.close();
          reject(err);
        });
      };

      const runSequential = (i) => {
        if (i >= count) return;
        doRequest(i);
        const checkNext = setInterval(() => {
          if (results[i]) {
            clearInterval(checkNext);
            runSequential(i + 1);
          }
        }, 10);
      };

      runSequential(0);
    });
  });
};

test("rate limiter allows requests within limit", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.member = { id: "user-1" }; next(); });
  app.use(userRateLimit({ windowMs: 60000, max: 10, keyPrefix: "rl1" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results = await makeRequests(app, "/test", 1);
  assert.equal(results[0].status, 200);
  assert.equal(results[0].body.success, true);
});

test("rate limiter returns 429 when limit exceeded", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.member = { id: "user-1" }; next(); });
  app.use(userRateLimit({ windowMs: 60000, max: 2, keyPrefix: "rl2" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results = await makeRequests(app, "/test", 3);
  assert.equal(results[0].status, 200);
  assert.equal(results[1].status, 200);
  assert.equal(results[2].status, 429);
  assert.ok(results[2].body.error.includes("Too many requests"));
});

test("rate limiter includes rate limit headers", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.member = { id: "user-1" }; next(); });
  app.use(userRateLimit({ windowMs: 60000, max: 10, keyPrefix: "rl3" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results = await makeRequests(app, "/test", 1);
  assert.ok(results[0].headers["x-ratelimit-limit"]);
  assert.ok(results[0].headers["x-ratelimit-remaining"]);
  assert.ok(results[0].headers["x-ratelimit-reset"]);
});

test("rate limiter decrements remaining count", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.member = { id: "user-1" }; next(); });
  app.use(userRateLimit({ windowMs: 60000, max: 5, keyPrefix: "rl4" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results = await makeRequests(app, "/test", 2);
  const remaining1 = parseInt(results[0].headers["x-ratelimit-remaining"]);
  const remaining2 = parseInt(results[1].headers["x-ratelimit-remaining"]);
  assert.equal(remaining1 - remaining2, 1);
});

test("rate limiter returns Retry-After header when exceeded", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.member = { id: "user-1" }; next(); });
  app.use(userRateLimit({ windowMs: 60000, max: 1, keyPrefix: "rl5" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results = await makeRequests(app, "/test", 2);
  assert.equal(results[1].status, 429);
  assert.ok(results[1].headers["retry-after"]);
});

test("rate limiter isolates different users", async () => {
  const app = express();
  app.use(express.json());
  let userId = "user-a";
  app.use((req, res, next) => { req.member = { id: userId }; next(); });
  app.use(userRateLimit({ windowMs: 60000, max: 1, keyPrefix: "rl6" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results1 = await makeRequests(app, "/test", 1);
  assert.equal(results1[0].status, 200);

  userId = "user-b";
  const results2 = await makeRequests(app, "/test", 1);
  assert.equal(results2[0].status, 200);
});

test("rate limiter skips when no member", async () => {
  const app = express();
  app.use(express.json());
  app.use(userRateLimit({ windowMs: 60000, max: 1, keyPrefix: "rl7" }));
  app.get("/test", (req, res) => res.json({ success: true }));

  const results = await makeRequests(app, "/test", 1);
  assert.equal(results[0].status, 200);
});
