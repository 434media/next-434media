// Export all queries
export { getCollectionQuery, getCollectionsQuery, getCollectionProductsQuery } from "./collection"
export { getMenuQuery } from "./menu"
export { getPageQuery, getPagesQuery } from "./page"
export { getProductQuery, getProductsQuery, getProductRecommendationsQuery } from "./product"
export { getCartQuery } from "./cart"

// Export all mutations
export { addToCartMutation, createCartMutation, editCartItemsMutation, removeFromCartMutation } from "../mutations/cart"