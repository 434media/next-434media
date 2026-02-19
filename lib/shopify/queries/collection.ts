export const getCollectionQuery = /* GraphQL */ `
  query getCollection($handle: String!) {
    collection(handle: $handle) {
      handle
      title
      description
      seo {
        title
        description
      }
      updatedAt
    }
  }
`

export const getCollectionProductsQuery = /* GraphQL */ `
  query getCollectionProducts(
    $handle: String!
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) {
    collection(handle: $handle) {
      products(sortKey: $sortKey, reverse: $reverse, first: 100) {
        edges {
          node {
            id
            handle
            availableForSale
            title
            description
            descriptionHtml
            options {
              id
              name
              values
            }
            priceRange {
              maxVariantPrice {
                amount
                currencyCode
              }
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  selectedOptions {
                    name
                    value
                  }
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
            featuredImage {
              url
              altText
              width
              height
            }
            images(first: 20) {
              edges {
                node {
                  url
                  altText
                  width
                  height
                }
              }
            }
            seo {
              title
              description
            }
            tags
            updatedAt
          }
        }
      }
    }
  }
`

export const getCollectionsQuery = /* GraphQL */ `
  query getCollections {
    collections(first: 100) {
      edges {
        node {
          handle
          title
          description
          seo {
            title
            description
          }
          updatedAt
        }
      }
    }
  }
`
