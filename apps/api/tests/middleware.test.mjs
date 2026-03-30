import test from "node:test";
import assert from "node:assert/strict";

const { requestContextMiddleware } = await import("../dist/middleware/requestContext.js");
const { rateLimitMiddleware } = await import("../dist/middleware/rateLimit.js");

test("requestContextMiddleware assigns request id header", async () => {
  const headers = new Map();
  const req = {
    header(name) {
      return name === "x-request-id" ? null : undefined;
    },
  };
  const res = {
    locals: {},
    setHeader(name, value) {
      headers.set(name, value);
    },
  };

  let called = false;
  requestContextMiddleware(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(typeof headers.get("x-request-id"), "string");
  assert.equal(res.locals.requestId, headers.get("x-request-id"));
});

test("rateLimitMiddleware blocks after limit", async () => {
  const middleware = rateLimitMiddleware(2, 60_000);
  let statusCode = 200;
  let payload = null;
  let retried = null;

  function makeRes() {
    statusCode = 200;
    payload = null;
    retried = null;
    return {
      setHeader(name, value) {
        if (name === "retry-after") retried = value;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        payload = body;
        return this;
      },
    };
  }

  const req = { ip: "127.0.0.1", path: "/health", socket: { remoteAddress: "127.0.0.1" } };

  let nextCount = 0;
  middleware(req, makeRes(), () => {
    nextCount += 1;
  });
  middleware(req, makeRes(), () => {
    nextCount += 1;
  });
  middleware(req, makeRes(), () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 2);
  assert.equal(statusCode, 429);
  assert.equal(payload.ok, false);
  assert.equal(payload.message, "Too many requests");
  assert.equal(typeof retried, "string");
});
