import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { createApp } from "./app.mjs";

function post(port, origin, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: "123456@astanait.edu.kz" });
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/auth/register",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(origin ? { Origin: origin } : {}),
          ...extraHeaders,
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response));
      },
    );
    request.on("error", reject);
    request.end(body);
  });
}

test("unsafe proxy requests require the configured exact Origin", async () => {
  const oldFrontendUrl = process.env.FRONTEND_URL;
  const oldFetch = globalThis.fetch;
  process.env.FRONTEND_URL = "https://study.example";
  let forwarded = 0;
  globalThis.fetch = async () => {
    forwarded += 1;
    return Response.json({ detail: "ok" }, { status: 202 });
  };
  const server = createApp({ serveStatic: false }).listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    assert.equal((await post(port)).statusCode, 403);
    assert.equal((await post(port, "https://evil.vercel.app")).statusCode, 403);
    assert.equal(
      (await post(port, "https://attacker.example", {
        "X-Forwarded-Host": "attacker.example",
      })).statusCode,
      403,
    );
    assert.equal(forwarded, 0);

    const response = await post(port, "https://study.example");
    assert.equal(response.statusCode, 202);
    assert.equal(forwarded, 1);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = oldFetch;
    if (oldFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = oldFrontendUrl;
  }
});
