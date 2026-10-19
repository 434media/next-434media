import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdtemp, rm, stat, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { transcodeArgs } from "./create-media"

/**
 * The Create table's one ffmpeg pass (plan v11 Step 2 item 4), for a video Canva may not take as it is: the file is
 * streamed to the function's temporary disk, converted with transcodeArgs (H.264 MP4, at most 1080 px wide, 30 fps,
 * fast-start) by the ffmpeg-static binary (founder-approved package, 2026-10-19), and returned as bytes. The input and
 * the output both sit in /tmp (about 512 MB on Vercel), so the input is capped by its counted bytes (maxBytes); the
 * download and the conversion share one deadline. The temporary directory is removed whatever happens. Measured on real clips: seconds per minute of video (step-2 evidence).
 */
export async function transcodeToMp4(body: ReadableStream<Uint8Array>, opts: { deadline: number; maxBytes: number }): Promise<{ bytes: Buffer; ms: number }> {
  const ffmpeg = (await import("ffmpeg-static")).default as unknown as string | null
  if (!ffmpeg) throw new Error("ffmpeg is not available on this server")
  const dir = await mkdtemp(join(tmpdir(), "create-media-"))
  const input = join(dir, "in"), output = join(dir, "out.mp4"), started = Date.now()
  // One clock for the download and the conversion together, so the caller's put and this cleanup still fit the function.
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(new Error("the conversion took too long; trim the clip")), Math.max(0, opts.deadline - started))
  try {
    // The declared length can be missing or wrong: the bytes are counted as they land on the temporary disk.
    let seen = 0
    const count = new Transform({ transform(chunk: Buffer, _enc, done) { seen += chunk.byteLength; done(seen > opts.maxBytes ? new Error(`the clip is over ${Math.round(opts.maxBytes / 1048576)} MB, too long to convert here; save it as MP4 and drop it again`) : null, chunk) } })
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>), count, createWriteStream(input), { signal: stop.signal })
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpeg, transcodeArgs(input, output), { stdio: ["ignore", "ignore", "pipe"], signal: stop.signal, killSignal: "SIGKILL" })
      let tail = ""
      child.stderr.on("data", (c: Buffer) => { tail = (tail + c.toString()).slice(-600) })
      child.on("error", err => reject(stop.signal.aborted ? stop.signal.reason : err))
      child.on("close", code => { if (code === 0) resolve(); else reject(stop.signal.aborted ? stop.signal.reason : new Error(`ffmpeg exited ${code}: ${tail.split("\n").filter(Boolean).slice(-2).join(" ")}`)) })
    })
    if (!(await stat(output)).size) throw new Error("the conversion produced an empty file")
    return { bytes: await readFile(output), ms: Date.now() - started }
  } catch (err) {
    throw stop.signal.aborted ? stop.signal.reason : err
  } finally {
    clearTimeout(timer)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
