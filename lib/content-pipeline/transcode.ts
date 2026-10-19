import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdtemp, rm, stat, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { transcodeArgs } from "./create-media"

/**
 * The Create table's one ffmpeg pass (plan v11 Step 2 item 4), for a video Canva may not take as it is: the file is
 * streamed to the function's temporary disk, converted with transcodeArgs (H.264 MP4, at most 1080 px wide, 30 fps,
 * fast-start) by the ffmpeg-static binary (founder-approved package, 2026-10-19), and returned as bytes. The temporary
 * directory is removed whatever happens. Measured on real clips: seconds per minute of video (step-2 evidence).
 */
export async function transcodeToMp4(body: ReadableStream<Uint8Array>, opts: { timeoutMs: number }): Promise<{ bytes: Buffer; ms: number }> {
  const ffmpeg = (await import("ffmpeg-static")).default as unknown as string | null
  if (!ffmpeg) throw new Error("ffmpeg is not available on this server")
  const dir = await mkdtemp(join(tmpdir(), "create-media-"))
  const input = join(dir, "in"), output = join(dir, "out.mp4"), started = Date.now()
  try {
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream<Uint8Array>), createWriteStream(input))
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpeg, transcodeArgs(input, output), { stdio: ["ignore", "ignore", "pipe"] })
      let tail = ""
      child.stderr.on("data", (c: Buffer) => { tail = (tail + c.toString()).slice(-600) })
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("the conversion took too long; trim the clip")) }, opts.timeoutMs)
      child.on("error", err => { clearTimeout(timer); reject(err) })
      child.on("close", code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`ffmpeg exited ${code}: ${tail.split("\n").filter(Boolean).slice(-2).join(" ")}`)) })
    })
    if (!(await stat(output)).size) throw new Error("the conversion produced an empty file")
    return { bytes: await readFile(output), ms: Date.now() - started }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
