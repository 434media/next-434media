import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler"

/** RFC 9728 protected-resource metadata for the publisher connector; advertised on every 401. */
const handler = protectedResourceHandler({
  authServerUrls: ["https://accounts.google.com"],
  resourceUrl: "https://www.434media.com/api/owned-meta/mcp",
})
const options = metadataCorsOptionsRequestHandler()
export { handler as GET, options as OPTIONS }
