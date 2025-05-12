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
  }
  
  // Collection-specific configurations
  const collectionConfigs: Record<string, Partial<CollectionConfig>> = {
    // TXMX Boxing collection - special configuration
    "txmx-boxing": {
      ctaText: "Shop Now",
      overlayPosition: "center",
      buttonStyle: "custom",
      customButtonClasses:
        "bg-black/40 backdrop-blur-sm text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300",
      logoSrc: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg", // Path to the TXMX logo in public folder
      logoWidth: 400, // Increased base size
      logoHeight: 200, // Increased base size
      scrollToProducts: true, // Enable scroll to products
      hideDownArrow: true, // Hide the down arrow since we're using the button instead
      hideText: true, // Explicitly hide the text
    },
  
    // Fallback for original "txmx" handle if it exists
    txmx: {
      ctaText: "Shop Now",
      overlayPosition: "center",
      buttonStyle: "custom",
      customButtonClasses:
        "bg-black/40 backdrop-blur-sm text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300",
      logoSrc: "/images/txmx-logo.png", // Path to the TXMX logo in public folder
      logoWidth: 400, // Increased base size
      logoHeight: 200, // Increased base size
      scrollToProducts: true, // Enable scroll to products
      hideDownArrow: true, // Hide the down arrow since we're using the button instead
      hideText: true, // Explicitly hide the text
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
  