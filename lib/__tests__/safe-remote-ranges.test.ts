/** Offline. The shared SSRF range list covers the special-purpose ranges CP-6 named. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { ipInPrivateRange } from "../safe-remote-fetch"

test("special-purpose and private ranges are refused", () => {
  for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "192.0.0.8", "192.0.2.1", "198.18.0.1", "198.19.255.1", "198.51.100.7", "203.0.113.9", "224.0.0.1", "240.0.0.1", "255.255.255.255", "::1", "fd00::1", "64:ff9b::a00:1", "2001:db8::1", "2002:a00:1::1", "ff02::1", "::ffff:10.0.0.1"]) {
    assert.equal(ipInPrivateRange(ip), true, ip)
  }
})

test("public addresses pass", () => {
  for (const ip of ["8.8.8.8", "23.1.2.3", "198.20.0.1", "2606:4700::1111"]) assert.equal(ipInPrivateRange(ip), false, ip)
})

import { captionUrlHosts } from "../content-pipeline/worker"
import { addressOf } from "../core-model/messages"

test("caption link hosts are read without www (CP-7)", () => {
  assert.deepEqual(captionUrlHosts("See https://www.army.mil/article/1 and www.evil.example/x."), ["army.mil", "evil.example"])
  assert.deepEqual(captionUrlHosts("Source: U.S. Army, 20 Nov 2026"), [])
})

test("addressOf is linear on hostile input and keeps its meaning (alert 107)", () => {
  assert.equal(addressOf("Pat <Pat@Example.com>"), "pat@example.com")
  assert.equal(addressOf("pat@example.com"), "pat@example.com")
  const start = Date.now(); addressOf("<".repeat(100_000)); assert.ok(Date.now() - start < 200)
})
