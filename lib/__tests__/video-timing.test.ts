/**
 * A Create-table video's length matched to its clip (lib/content-pipeline/video-timing.ts). Offline: the MP4 boxes
 * are built here, storage is an in-memory range reader, and the ffmpeg cases make their own synthetic clips (a test
 * pattern, a tone and a white tail, nothing from any brand) with the ffmpeg-static binary the app ships. Those cases
 * are skipped only where the binary isn't installed; CI installs it.
 *
 * The case behind it (2026-11-05): a 21.4 s clip came out of the News Feed template as a 60 s video with a white tail.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { clock, decideTiming, fitVideoExport, mp4Timing, probeMp4Timing, trimArgs, trimTail, TIMING_TOLERANCE_SEC, type FitDeps, type Mp4Timing, type RangeReader } from "../content-pipeline/video-timing"

// ── MP4 boxes, by hand ──
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b }
const u64 = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b }
const box = (type: string, ...parts: Buffer[]) => { const body = Buffer.concat(parts); return Buffer.concat([u32(8 + body.length), Buffer.from(type, "latin1"), body]) }
const bigBox = (type: string, body: Buffer) => Buffer.concat([u32(1), Buffer.from(type, "latin1"), u64(16 + body.length), body])
const full = (v: number) => Buffer.from([v, 0, 0, 0])
const mvhd = (scale: number, dur: number, v = 0) => box("mvhd", full(v), v ? Buffer.concat([u64(0), u64(0), u32(scale), u64(dur)]) : Buffer.concat([u32(0), u32(0), u32(scale), u32(dur)]), Buffer.alloc(80))
const tkhd = (dur: number, v = 0) => box("tkhd", full(v), v ? Buffer.concat([u64(0), u64(0), u32(1), u32(0), u64(dur)]) : Buffer.concat([u32(0), u32(0), u32(1), u32(0), u32(dur)]), Buffer.alloc(60))
const mdhd = (scale: number, dur: number) => box("mdhd", full(0), u32(0), u32(0), u32(scale), u32(dur), Buffer.alloc(4))
const hdlr = (kind: "vide" | "soun") => box("hdlr", full(0), u32(0), Buffer.from(kind, "latin1"), Buffer.alloc(12))
const trak = (kind: "vide" | "soun", movieUnits: number, mediaScale: number, mediaUnits: number, v = 0) => box("trak", tkhd(movieUnits, v), box("mdia", mdhd(mediaScale, mediaUnits), hdlr(kind)))
const ftyp = box("ftyp", Buffer.from("isom", "latin1"), u32(512), Buffer.from("isomiso2avc1mp41", "latin1"))
/** A movie at timescale 1000: video `v` s, sound `a` s (none when null). */
function moov(v: number | null, a: number | null, opts: { version?: number; fragmented?: boolean } = {}) {
  const ver = opts.version ?? 0, ms = (s: number) => Math.round(s * 1000)
  const movie = Math.max(v ?? 0, a ?? 0)
  return box("moov", mvhd(1000, ms(movie), ver), ...(v !== null ? [trak("vide", ms(v), 30000, Math.round(v * 30000), ver)] : []), ...(a !== null ? [trak("soun", ms(a), 48000, Math.round(a * 48000), ver)] : []), ...(opts.fragmented ? [box("mvex")] : []))
}
const file = (...parts: Buffer[]) => new Uint8Array(Buffer.concat([ftyp, ...parts]))

function memoryReader(bytes: Uint8Array): RangeReader & { reads: [number, number][] } {
  const reads: [number, number][] = []
  const r = (async (_url: string, start: number, end: number) => { reads.push([start, end]); return { bytes: bytes.subarray(start, Math.min(end + 1, bytes.length)), total: bytes.length } }) as RangeReader & { reads: typeof reads }
  r.reads = reads
  return r
}

test("lengths are read from the file's own boxes: video, sound and movie, 32- and 64-bit", () => {
  assert.deepEqual(mp4Timing(file(moov(21.4, 21.4), box("mdat", Buffer.alloc(64)))), { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 })
  assert.deepEqual(mp4Timing(file(box("mdat", Buffer.alloc(64)), moov(60, 21.4, { version: 1 }))), { movieSec: 60, videoSec: 60, audioSec: 21.4 })
  assert.deepEqual(mp4Timing(file(moov(12.5, null))), { movieSec: 12.5, videoSec: 12.5, audioSec: null }, "a silent clip has no sound track")
  assert.deepEqual(mp4Timing(file(moov(20, 20, { fragmented: true }))), { movieSec: null, videoSec: null, audioSec: null }, "a fragmented file's length is never guessed")
  assert.throws(() => mp4Timing(new Uint8Array(Buffer.from("not a video at all"))))
  assert.throws(() => mp4Timing(file(box("mdat", Buffer.alloc(8)))), /no moov/)
})

test("a stored clip is measured with range reads: only box headers and moov, never the media", async () => {
  const mdat = Buffer.alloc(1_000_000, 7)
  const atStart = file(moov(21.4, 21.4), box("mdat", mdat))
  const r1 = memoryReader(atStart)
  assert.deepEqual(await probeMp4Timing(r1, "https://x/c.mp4"), { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 })
  assert.ok(r1.reads.every(([s, e]) => e - s < 4096), "fast-start: nothing near the media's size is read")
  const atEnd = file(bigBox("mdat", mdat), moov(33.3, 33.3))
  const r2 = memoryReader(atEnd)
  assert.equal((await probeMp4Timing(r2, "https://x/c.mov")).videoSec, 33.3)
  assert.ok(r2.reads.every(([s, e]) => e - s < 4096), "moov after the media: the 64-bit mdat header is skipped, not read")
  await assert.rejects(probeMp4Timing(memoryReader(new Uint8Array(Buffer.from("<html>not a clip</html>"))), "https://x/p"), /not an MP4/)
  await assert.rejects(probeMp4Timing(memoryReader(file(box("mdat", Buffer.alloc(32)))), "https://x/n"), /no moov/)
})

test("the rules: same length is used, a blank tail is cut, anything short or silent or unknown is held", () => {
  const clip = { sec: 21.4, audio: true }
  const t = (v: number | null, a: number | null): Mp4Timing => ({ movieSec: v, videoSec: v, audioSec: a })
  assert.deepEqual(decideTiming(clip, t(21.4, 21.4)), { action: "matched" })
  assert.deepEqual(decideTiming(clip, t(21.4 + TIMING_TOLERANCE_SEC, 21.4)), { action: "matched" }, "a frame or two over is the same length")
  assert.deepEqual(decideTiming(clip, t(60, 21.4)), { action: "trim", toSec: 21.4 }, "the 2026-11-05 case: 60 s from a 21.4 s clip")
  assert.deepEqual(decideTiming(clip, t(60, 60)), { action: "trim", toSec: 21.4 })
  const cut = decideTiming(clip, t(5, 5))
  assert.equal(cut.action, "hold"); assert.match((cut as { why: string }).why, /Canva cut the clip: the video runs 0:05.0, the clip 0:21.4/)
  assert.match((decideTiming(clip, t(21.4, null)) as { why: string }).why, /has sound but the exported video has none/)
  assert.match((decideTiming(clip, t(60, 5)) as { why: string }).why, /sound stops early: it runs 0:05.0 of the clip's 0:21.4/)
  assert.deepEqual(decideTiming({ sec: 21.4, audio: false }, t(60, null)), { action: "trim", toSec: 21.4 }, "a silent clip needs no sound")
  assert.match((decideTiming(null, t(60, 60)) as { why: string }).why, /clip's length couldn't be read/)
  assert.match((decideTiming({ sec: 0, audio: true }, t(60, 60)) as { why: string }).why, /clip's length couldn't be read/)
  assert.match((decideTiming(clip, null) as { why: string }).why, /exported video's length couldn't be read/)
  assert.match((decideTiming(clip, t(null, null)) as { why: string }).why, /exported video's length couldn't be read/)
  // Any clip length: short, long, and a clip longer than the template's page.
  for (const s of [3, 7.5, 21.4, 44.9, 90, 179.9]) {
    assert.deepEqual(decideTiming({ sec: s, audio: true }, t(s, s)), { action: "matched" })
    assert.deepEqual(decideTiming({ sec: s, audio: true }, t(s + 30, s)), { action: "trim", toSec: s })
    assert.equal(decideTiming({ sec: s, audio: true }, t(Math.max(0.5, s - 1), s)).action, "hold")
  }
  assert.equal(clock(21.4), "0:21.4"); assert.equal(clock(60), "1:00.0"); assert.equal(clock(5), "0:05.0")
})

function fitDeps(exportBytes: Uint8Array, clip: Mp4Timing | Error, trim: FitDeps["trim"] = async (_b, sec) => file(moov(sec, sec))): FitDeps & { trims: number[] } {
  const trims: number[] = []
  return { trims, fetchExport: async () => exportBytes, probeClip: async () => { if (clip instanceof Error) throw clip; return clip }, trim: async (b, sec) => { trims.push(sec); return trim(b, sec) }, now: () => "2026-11-05T18:00:00.000Z" }
}
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")

test("fitting: a 60 s export of a 21.4 s clip is cut, measured again, and recorded against the cut file", async () => {
  const exp = file(moov(60, 21.4))
  const d = fitDeps(exp, { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 })
  const r = await fitVideoExport(d, "https://export.canva.com/v.mp4", { url: "https://s.public.blob.vercel-storage.com/content-create/c.mp4" })
  assert.deepEqual(d.trims, [21.4])
  assert.equal(r.timing.action, "trimmed"); assert.equal(r.timing.export_sec, 60); assert.equal(r.timing.final_sec, 21.4); assert.equal(r.timing.hold, undefined)
  assert.equal(r.timing.sha256, sha(r.bytes)); assert.notEqual(r.timing.sha256, sha(exp))
  assert.deepEqual({ clip: r.timing.clip_sec, audio: r.timing.clip_audio }, { clip: 21.4, audio: true })
  // Repeated runs: the same inputs give the same decision and the same recorded file.
  const again = await fitVideoExport(fitDeps(exp, { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }), "https://export.canva.com/v.mp4", { url: "https://s/c.mp4" })
  assert.deepEqual(again.timing, r.timing)
})

test("fitting: a matching export is used as it is; a short, unreadable or uncuttable one is attached but held", async () => {
  const same = file(moov(21.5, 21.5))
  const ok = await fitVideoExport(fitDeps(same, { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }), "u", { url: "c" })
  assert.equal(ok.timing.action, "matched"); assert.equal(ok.bytes, same); assert.equal(ok.timing.sha256, sha(same))

  const short = file(moov(5, 5))
  const cut = await fitVideoExport(fitDeps(short, { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }), "u", { url: "c" })
  assert.equal(cut.timing.action, "held"); assert.match(cut.timing.hold!, /Canva cut the clip/); assert.equal(cut.bytes, short, "a held video is still shown")

  const lost = await fitVideoExport(fitDeps(file(moov(60, 60)), new Error("range read answered 404")), "u", { url: "c" })
  assert.equal(lost.timing.action, "held"); assert.equal(lost.timing.clip_sec, null); assert.match(lost.timing.hold!, /clip's length couldn't be read/)

  const none = await fitVideoExport(fitDeps(file(moov(60, 60)), { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }), "u", null)
  assert.equal(none.timing.action, "held", "no clip known (an old post's Refresh): held, never assumed")

  const broken = await fitVideoExport(fitDeps(new Uint8Array(Buffer.from("garbage")), { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }), "u", { url: "c" })
  assert.match(broken.timing.hold!, /exported video's length couldn't be read/)

  const failed = await fitVideoExport(fitDeps(file(moov(60, 60)), { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }, async () => { throw new Error("ffmpeg exited 1") }), "u", { url: "c" })
  assert.equal(failed.timing.action, "held"); assert.match(failed.timing.hold!, /blank end couldn't be cut here/)

  const wrong = await fitVideoExport(fitDeps(file(moov(60, 60)), { movieSec: 21.4, videoSec: 21.4, audioSec: 21.4 }, async () => file(moov(30, 30))), "u", { url: "c" })
  assert.equal(wrong.timing.action, "held"); assert.match(wrong.timing.hold!, /didn't come out the clip's length \(0:30.0\)/)

  // Refresh from Canva: the clip's length from the row's last check.
  const known = await fitVideoExport(fitDeps(file(moov(60, 60)), new Error("not read")), "u", { sec: 21.4, audio: true })
  assert.equal(known.timing.action, "trimmed")
})

test("the cut copies the streams as they are, ends at the clip, and starts fast", () => {
  assert.deepEqual(trimArgs("in.mp4", "out.mp4", 21.4), ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", "in.mp4", "-t", "21.400", "-map", "0:v:0", "-map", "0:a?", "-c", "copy", "-movflags", "+faststart", "-y", "out.mp4"])
})

// ── Real ffmpeg, on synthetic clips ──
let ffmpeg: string | null = null
/** The ffmpeg-static binary, or null where it isn't installed (the case then skips; CI installs it). */
async function ffmpegBin(): Promise<string | null> {
  try { const p = (await import("ffmpeg-static")).default as unknown as string | null; ffmpeg = p && existsSync(p) ? p : null } catch { ffmpeg = null }
  return ffmpeg
}

function run(args: string[]) {
  const r = spawnSync(ffmpeg!, ["-hide_banner", "-loglevel", "error", "-nostdin", ...args], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}: ${r.stderr.toString()}`)
  return r.stdout
}
/** The mean luma (0–255) of a region of the frame at `at` seconds. */
function luma(path: string, at: number, crop: string) {
  return run(["-ss", String(at), "-i", path, "-frames:v", "1", "-vf", `crop=${crop},scale=1:1:flags=area`, "-f", "rawvideo", "-pix_fmt", "gray", "-"])[0]
}
/**
 * A Canva-like export: the clip (a test pattern and a tone, `clipSec` long), then a white page with silence up to
 * `pageSec`, under a black name bar along the top for the whole page (the template's overlay, timed to the page).
 */
function makeExport(dir: string, clipSec: number, pageSec: number, name: string) {
  const out = join(dir, name), tail = pageSec - clipSec
  run([
    "-f", "lavfi", "-i", `testsrc=size=320x400:rate=30:duration=${clipSec}`,
    "-f", "lavfi", "-i", `color=white:size=320x400:rate=30:duration=${Math.max(tail, 0.04)}`,
    "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${clipSec}`,
    "-filter_complex", `${tail > 0 ? "[0:v][1:v]concat=n=2:v=1:a=0" : "[0:v]null"},drawbox=x=0:y=0:w=320:h=40:color=black:t=fill[v];[2:a]apad=whole_dur=${pageSec}[a]`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-g", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", "-y", out,
  ])
  return out
}

test("ffmpeg: a 60 s export of a 21.4 s clip comes out 21.4 s, with its sound, no white tail, and the overlay to the end", async t => {
  if (!await ffmpegBin()) { assert.ok(!process.env.CI, "ffmpeg-static must be installed in CI"); return t.skip("ffmpeg-static isn't installed here (CI installs it)") }
  const dir = await mkdtemp(join(tmpdir(), "video-timing-test-"))
  try {
    const clipPath = makeExport(dir, 21.4, 21.4, "clip.mp4")
    const clipBytes = new Uint8Array(await readFile(clipPath))
    const exportBytes = new Uint8Array(await readFile(makeExport(dir, 21.4, 60, "export.mp4")))
    const before = mp4Timing(exportBytes)
    assert.ok(Math.abs(before.videoSec! - 60) < 0.1, `the export runs the page: ${before.videoSec}`)
    // The white tail is there before the cut.
    assert.ok(luma(join(dir, "export.mp4"), 40, "320:300:0:80") > 230, "white after the clip")

    const r = await fitVideoExport({ fetchExport: async () => exportBytes, probeClip: async () => probeMp4Timing(memoryReader(clipBytes), "c"), trim: (b, s) => trimTail(b, s, { ffmpeg: ffmpeg! }), now: () => "t" }, "u", { url: "c" })
    assert.equal(r.timing.action, "trimmed", r.timing.hold)
    const after = mp4Timing(r.bytes)
    assert.ok(Math.abs(after.videoSec! - 21.4) <= TIMING_TOLERANCE_SEC, `video ${after.videoSec}`)
    assert.ok(after.audioSec! >= 21.4 - TIMING_TOLERANCE_SEC, `sound ${after.audioSec}`)
    const cutPath = join(dir, "cut.mp4")
    await (await import("node:fs/promises")).writeFile(cutPath, r.bytes)
    // The last frame is the clip, not the white page; the overlay is still on it; the start is untouched.
    assert.ok(luma(cutPath, 21.2, "320:300:0:80") < 200, "the clip's last frame is the clip")
    assert.ok(luma(cutPath, 21.2, "320:40:0:0") < 30, "the overlay runs to the clip's end")
    assert.ok(luma(cutPath, 0.5, "320:40:0:0") < 30, "and from its start")
    // Repeated cuts of the same export are the same file.
    assert.equal(sha(await trimTail(exportBytes, 21.4, { ffmpeg: ffmpeg! })), sha(r.bytes))
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test("ffmpeg: any clip length — short, long, and exactly the page — is matched or cut, never left long", async t => {
  if (!await ffmpegBin()) { assert.ok(!process.env.CI, "ffmpeg-static must be installed in CI"); return t.skip("ffmpeg-static isn't installed here (CI installs it)") }
  const dir = await mkdtemp(join(tmpdir(), "video-timing-test-"))
  try {
    for (const [clipSec, pageSec] of [[4.2, 60], [47.3, 60], [30, 30]] as const) {
      const clip = new Uint8Array(await readFile(makeExport(dir, clipSec, clipSec, `c${clipSec}.mp4`)))
      const exp = new Uint8Array(await readFile(makeExport(dir, clipSec, pageSec, `e${clipSec}.mp4`)))
      const r = await fitVideoExport({ fetchExport: async () => exp, probeClip: async () => mp4Timing(clip), trim: (b, s) => trimTail(b, s, { ffmpeg: ffmpeg! }), now: () => "t" }, "u", { url: "c" })
      assert.equal(r.timing.action, pageSec > clipSec ? "trimmed" : "matched", `${clipSec}/${pageSec}: ${r.timing.hold ?? ""}`)
      assert.ok(Math.abs(mp4Timing(r.bytes).videoSec! - clipSec) <= TIMING_TOLERANCE_SEC)
    }
    // A clip longer than the page: Canva would cut it. Held, not cut further.
    const clip = new Uint8Array(await readFile(makeExport(dir, 25, 25, "long.mp4")))
    const exp = new Uint8Array(await readFile(makeExport(dir, 10, 10, "page10.mp4")))
    const r = await fitVideoExport({ fetchExport: async () => exp, probeClip: async () => mp4Timing(clip), trim: (b, s) => trimTail(b, s, { ffmpeg: ffmpeg! }), now: () => "t" }, "u", { url: "c" })
    assert.equal(r.timing.action, "held"); assert.match(r.timing.hold!, /Canva cut the clip: the video runs 0:10.0, the clip 0:25.0/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test("a clip whose sound ends a little before its picture isn't held for that", () => {
  assert.deepEqual(decideTiming({ sec: 21.4, audio: true, audioSec: 20.9 }, { movieSec: 60, videoSec: 60, audioSec: 20.9 }), { action: "trim", toSec: 21.4 })
  assert.equal(decideTiming({ sec: 21.4, audio: true, audioSec: 20.9 }, { movieSec: 60, videoSec: 60, audioSec: 12 }).action, "hold")
})
