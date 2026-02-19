// Configuration for collection banners
export interface CollectionConfig {
  title?: string // Override collection title
  description?: string // Override collection description
  ctaText: string // Call to action button text
  ctaLink: string // Link for the CTA button
  overlayPosition: "center" | "left" | "right"
  textColor: string
  buttonStyle: "primary" | "secondary" | "outline" | "transparent" | "custom"
  customButtonClasses?: string // For fully custom button styling
  logoSrc?: string // Optional logo image source
  logoWidth?: number // Logo width
  logoHeight?: number // Logo height
  scrollToProducts?: boolean // Whether to scroll to products section on button click
  hideDownArrow?: boolean // Whether to hide the down arrow
  hideText?: boolean // Explicitly hide text even if no logo
  customAnimation?: "none" | "fade" | "slide" | "zoom" | "pulse" // Custom animation for the banner
  videoOverlay?: string // Optional overlay color for videos (e.g., "rgba(0,0,0,0.4)")
  secondaryCta?: {
    // Optional secondary CTA button
    text: string
    link: string
    style: "primary" | "secondary" | "outline" | "transparent" | "custom"
    customClasses?: string
  }
}

// Default configuration
const defaultConfig: CollectionConfig = {
  ctaText: "Shop Collection",
  ctaLink: "", // Will be set to collection path
  overlayPosition: "center",
  textColor: "white",
  buttonStyle: "primary",
  scrollToProducts: false,
  hideDownArrow: false,
  hideText: false,
  customAnimation: "fade",
}

// Collection-specific configurations
const collectionConfigs: Record<string, Partial<CollectionConfig>> = {
  // TXMX Boxing collection - special configuration
  "txmx-boxing": {
    ctaText: "Shop Now",
    overlayPosition: "center",
    buttonStyle: "custom",
    customButtonClasses:
      "bg-black/40 backdrop-blur-sm text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300 text-lg font-bold px-8 py-4",
    logoSrc: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg", // Path to the TXMX logo
    logoWidth: 800, // Significantly increased logo size
    logoHeight: 400, // Significantly increased logo size
    scrollToProducts: true, // Enable scroll to products
    hideDownArrow: true, // Hide the down arrow as requested
    hideText: true, // Explicitly hide the text
    customAnimation: "zoom", // Special zoom animation for TXMX
    videoOverlay: "rgba(0,0,0,0.25)", // Slight darkening for better contrast
  },

  // Fallback for original "txmx" handle if it exists
  txmx: {
    ctaText: "Shop Now",
    overlayPosition: "center",
    buttonStyle: "custom",
    customButtonClasses:
      "bg-black/40 backdrop-blur-sm text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300 text-lg font-bold px-8 py-4",
    logoSrc: "/images/txmx-logo.png", // Path to the TXMX logo in public folder
    logoWidth: 1200, // Significantly increased logo size
    logoHeight:1200, // Significantly increased logo size
    scrollToProducts: true, // Enable scroll to products
    hideDownArrow: true, // Hide the down arrow as requested
    hideText: true, // Explicitly hide the text
    customAnimation: "zoom", // Special zoom animation for TXMX
    videoOverlay: "rgba(0,0,0,0.25)", // Slight darkening for better contrast
  },

  // Featured collection
  featured: {
    ctaText: "Shop Featured Items",
    overlayPosition: "left",
    buttonStyle: "primary",
  },

  // Summer collection
  summer: {
    ctaText: "Summer Essentials",
    overlayPosition: "right",
    buttonStyle: "outline",
  },

  // Winter collection
  winter: {
    ctaText: "Winter Collection",
    overlayPosition: "left",
    textColor: "white",
    buttonStyle: "secondary",
  },

  // New arrivals
  "new-arrivals": {
    ctaText: "Shop New Arrivals",
    overlayPosition: "center",
    buttonStyle: "primary",
  },

  // Sale items
  sale: {
    ctaText: "Shop Sale",
    overlayPosition: "right",
    textColor: "white",
    buttonStyle: "secondary",
  },

  // Add more collections as needed
}

/**
 * Get configuration for a specific collection
 * @param collectionHandle The collection handle from Shopify
 * @param collectionPath The path to the collection (for default CTA link)
 */
export function getCollectionConfig(collectionHandle: string, collectionPath: string): CollectionConfig {
  // Get collection-specific config or empty object if not found
  const specificConfig = collectionConfigs[collectionHandle] || {}

  // Merge with default config
  const config = {
    ...defaultConfig,
    ...specificConfig,
    // Set default CTA link to collection path if not specified
    ctaLink: specificConfig.ctaLink || collectionPath,
  }

  return config as CollectionConfig
}
