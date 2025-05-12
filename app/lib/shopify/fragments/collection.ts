import imageFragment from "./image"
import seoFragment from "./seo"

const collectionFragment = /* GraphQL */ `
  fragment collection on Collection {
    handle
    title
    description
    image {
      ...image
    }
    seo {
      ...seo
    }
    updatedAt
  }
  ${imageFragment}
  ${seoFragment}
`

export default collectionFragment