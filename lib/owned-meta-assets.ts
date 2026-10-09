import { createHash } from "node:crypto"
import type { MetaAsset } from "./owned-meta-publisher"
import { MetaBlocked } from "./owned-meta-publisher"

// Server-memory safeguard, NOT a Meta format limit. Larger exports need an approved streaming path.
export const MAX_SOURCE_BYTES = 64 * 1024 * 1024
export function assetDigest(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex") }
/** Existing public, UUID-named content exports only; never creates another copy. */
export function assertApprovedBlobUrl(raw: string, origins: string[]): string {
  const u=new URL(raw)
  if(u.protocol!=="https:" || u.username || u.password || u.search || u.hash || !u.hostname.endsWith(".public.blob.vercel-storage.com") || !origins.includes(u.origin) || !/^\/content-posts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.-][a-zA-Z0-9._-]+$/.test(u.pathname)) throw new MetaBlocked("Use an existing approved-store UUID Blob export; do not copy or transform it")
  return u.toString()
}
export async function readTrustedAsset(url: string, origins: string[], fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  const u = new URL(assertApprovedBlobUrl(url,origins))
  const response = await fetcher(u, { redirect: "error", cache: "no-store" })
  if (!response.ok || !response.body) throw new MetaBlocked("Cannot read approved export; refresh its source for review")
  if (Number(response.headers.get("content-length") || 0) > MAX_SOURCE_BYTES) throw new MetaBlocked("Export exceeds the 64 MiB server safety bound")
  const chunks: Uint8Array[] = []; let size = 0
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength
    if (size > MAX_SOURCE_BYTES) { await response.body.cancel().catch(() => {}); throw new MetaBlocked("Export exceeds the 64 MiB server safety bound") }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
export function verifyAssetBytes(asset: MetaAsset, bytes: Uint8Array): void {
  if (bytes.byteLength !== asset.size || assetDigest(bytes) !== asset.sha256) throw new MetaBlocked("Export bytes changed; a new review is required")
  // Check signatures, not just a caller-supplied extension. Preserve bytes and metadata exactly.
  const b = Buffer.from(bytes)
  const signature = asset.mime === "image/jpeg" ? b[0] === 0xff && b[1] === 0xd8 : asset.mime === "image/png" ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : b.subarray(4,8).toString() === "ftyp"
  if (!signature) throw new MetaBlocked("Media signature does not match approved MIME type")
}
/** Measures pixels/duration from bytes; supplied form metadata is never a format gate. */
export function measureExport(bytes: Uint8Array): { mime: MetaAsset["mime"]; width: number; height: number; duration?: number } {
  const b=Buffer.from(bytes)
  if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {mime:"image/png",width:b.readUInt32BE(16),height:b.readUInt32BE(20)}
  if(b[0]===255&&b[1]===216) {
    let p=2,orientation=1,width=0,height=0
    while(p+4<=b.length) {
      if(b[p]!==255)throw new MetaBlocked("Malformed JPEG")
      const marker=b[p+1];p+=2
      if(marker===0xd9||marker===0xda)break
      if(marker===0xd8||marker===0x01)continue
      const n=b.readUInt16BE(p);if(n<2||p+n>b.length)throw new MetaBlocked("Truncated JPEG")
      if(marker===0xe1&&b.subarray(p+2,p+8).toString()==="Exif\0\0") {
        const base=p+8,limit=p+n,little=b.subarray(base,base+2).toString()==="II"
        const u16=(o:number)=>{if(o<base||o+2>limit)throw new MetaBlocked("Malformed EXIF");return little?b.readUInt16LE(o):b.readUInt16BE(o)}
        const u32=(o:number)=>{if(o<base||o+4>limit)throw new MetaBlocked("Malformed EXIF");return little?b.readUInt32LE(o):b.readUInt32BE(o)}
        if(u16(base+2)!==42)throw new MetaBlocked("Unsupported EXIF orientation metadata")
        const ifd=base+u32(base+4),count=u16(ifd)
        for(let i=0;i<count;i++){const q=ifd+2+i*12;if(q+12>limit)throw new MetaBlocked("Malformed EXIF");if(u16(q)===0x112){if(u16(q+2)!==3||u32(q+4)!==1)throw new MetaBlocked("Malformed EXIF orientation");orientation=u16(q+8)}}
        if(orientation<1||orientation>8)throw new MetaBlocked("Invalid EXIF orientation")
      }
      if([0xc0,0xc1,0xc2].includes(marker)&&n>=8){width=b.readUInt16BE(p+5);height=b.readUInt16BE(p+3)}
      p+=n
    }
    if(width&&height)return {mime:"image/jpeg",width:orientation>=5?height:width,height:orientation>=5?width:height}
    throw new MetaBlocked("JPEG dimensions unavailable")
  }
  interface Box { type:string; start:number; end:number }
  function boxes(start:number,end:number):Box[]{const out:Box[]=[];for(let p=start;p<end;){if(p+8>end)throw new MetaBlocked("Truncated MP4 box");let size=b.readUInt32BE(p),head=8;if(size===1){if(p+16>end)throw new MetaBlocked("Truncated MP4 box");const big=b.readBigUInt64BE(p+8);if(big>BigInt(Number.MAX_SAFE_INTEGER))throw new MetaBlocked("MP4 box too large");size=Number(big);head=16}else if(size===0)size=end-p;if(size<head||p+size>end)throw new MetaBlocked("Invalid MP4 box");out.push({type:b.subarray(p+4,p+8).toString(),start:p+head,end:p+size});p+=size}return out}
  if(b.length<12||b.subarray(4,8).toString()!=="ftyp")throw new MetaBlocked("Unsupported export format")
  const root=boxes(0,b.length),moov=root.find(x=>x.type==="moov")
  if(!moov)throw new MetaBlocked("Video metadata unavailable")
  for(const trak of boxes(moov.start,moov.end).filter(x=>x.type==="trak")) {
    const children=boxes(trak.start,trak.end),tkhd=children.find(x=>x.type==="tkhd"),mdia=children.find(x=>x.type==="mdia")
    if(!tkhd||!mdia)continue
    const media=boxes(mdia.start,mdia.end),hdlr=media.find(x=>x.type==="hdlr"),mdhd=media.find(x=>x.type==="mdhd")
    if(!hdlr||hdlr.start+12>hdlr.end||b.subarray(hdlr.start+8,hdlr.start+12).toString()!=="vide"||!mdhd)continue
    if(tkhd.end-tkhd.start<84)throw new MetaBlocked("Video dimensions unavailable")
    let width=b.readUInt32BE(tkhd.end-8)/65536,height=b.readUInt32BE(tkhd.end-4)/65536
    const matrixStart=tkhd.end-44,a=b.readInt32BE(matrixStart),d=b.readInt32BE(matrixStart+16)
    if(a===0&&d===0)[width,height]=[height,width]
    const version=b[mdhd.start],timeOffset=version===1?20:12,durationOffset=version===1?24:16
    if(mdhd.start+durationOffset+(version===1?8:4)>mdhd.end)throw new MetaBlocked("Video duration unavailable")
    const scale=b.readUInt32BE(mdhd.start+timeOffset),duration=version===1?Number(b.readBigUInt64BE(mdhd.start+durationOffset)):b.readUInt32BE(mdhd.start+durationOffset)
    if(!scale||!width||!height||!Number.isFinite(duration))throw new MetaBlocked("Invalid video metadata")
    return {mime:"video/mp4",width,height,duration:duration/scale}
  }
  throw new MetaBlocked("Video track metadata unavailable")
}
