const { EventEmitter } = require("events");

const createIoStub = () => {
  const events = [];

  return {
    events,
    to(channel) {
      return {
        emit(event, payload) {
          events.push({ channel, event, payload });
        },
      };
    },
  };
};

const createTestServer = async ({ basePath, router }) => {
  const io = createIoStub();

  return {
    io,
    async request(pathname, options = {}) {
      const url = new URL(`http://localhost${pathname}`);
      const headers = Object.fromEntries(
        Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value])
      );

      const req = new EventEmitter();
      req.method = options.method || "GET";
      req.url = url.pathname + url.search;
      req.originalUrl = `${basePath}${url.pathname}${url.search}`;
      req.baseUrl = basePath;
      req.path = url.pathname;
      req.query = Object.fromEntries(url.searchParams.entries());
      req.headers = headers;
      req.body = options.body || {};
      req.io = io;
      req.get = (name) => req.headers[name.toLowerCase()];
      req.header = req.get;

      return new Promise((resolve, reject) => {
        let settled = false;

        const finish = (payload) => {
          if (settled) return;
          settled = true;
          resolve(payload);
        };

        const res = {
          locals: {},
          statusCode: 200,
          headers: {},
          setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
          },
          getHeader(name) {
            return this.headers[name.toLowerCase()];
          },
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(payload) {
            finish({ status: this.statusCode, body: payload });
            return this;
          },
          send(payload) {
            finish({ status: this.statusCode, body: payload });
            return this;
          },
          end(payload) {
            finish({ status: this.statusCode, body: payload || null });
            return this;
          },
        };

        req.res = res;
        res.req = req;

        router.handle(req, res, (err) => {
          if (err) {
            reject(err);
            return;
          }

          finish({ status: res.statusCode, body: null });
        });
      });
    },
    async close() {},
  };
};

module.exports = {
  createTestServer,
};
