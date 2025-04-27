// Comprehensive type definitions for the dictionary
export interface Dictionary {
  common?: {
    learnMore?: string
    viewAll?: string
    submit?: string
    loading?: string
    error?: string
    success?: string
    language?: string
    [key: string]: any
  }
  navigation?: {
    home?: string
    about?: string
    services?: string
    portfolio?: string
    contact?: string
    blog?: string
    [key: string]: any
  }
  home?: {
    hero?: {
      title?: string
      subtitle?: string
      cta?: string
      [key: string]: any
    }
    services?: {
      title?: string
      subtitle?: string
      items?: {
        [key: string]: {
          title?: string
          description?: string
          [key: string]: any
        }
      }
      [key: string]: any
    }
    about?: {
      title?: string
      content?: string
      [key: string]: any
    }
    contact?: {
      title?: string
      subtitle?: string
      form?: {
        name?: string
        email?: string
        message?: string
        submit?: string
        [key: string]: any
      }
      [key: string]: any
    }
    [key: string]: any
  }
  sdoh?: {
    title?: string
    subtitle?: string
    intro1?: string
    intro2Part1?: string
    sdohFull?: string
    intro2Part2?: string
    hero?: {
      title?: string
      subtitle?: string
      cta?: string
      [key: string]: any
    }
    mission?: {
      title?: string
      content?: string
      partnershipTitle?: string
      [key: string]: any
    }
    features?: {
      title?: string
      items?: {
        [key: string]: {
          title?: string
          description?: string
          [key: string]: any
        }
      }
      [key: string]: any
    }
    newsletter?: {
      title?: string
      subtitle?: string
      placeholder?: string
      submit?: string
      success?: string
      error?: string
      [key: string]: any
    }
    bootcamp?: {
      title?: string
      subtitle?: string
      description?: string
      rgvTitle?: string
      when?: string
      date?: string
      where?: string
      location?: string
      cta?: string
      [key: string]: any
    }
    accelerator?: {
      title?: string
      subtitle?: string
      description1?: string
      description2?: string
      [key: string]: any
    }
    demoDay?: {
      title?: string
      description?: string
      loadingText?: string
      errorTitle?: string
      errorMessage?: string
      learnMore?: string
      [key: string]: any
    }
    impact?: {
      question?: string
      message?: string
      conclusion?: string
      [key: string]: any
    }
    partnership?: {
      label?: string
      title?: string
      description?: string
      velocityAlt?: string
      methodistAlt?: string
      [key: string]: any
    }
    seminar?: {
      title?: string
      description1?: string
      description2?: string
      causa?: string
      description2End?: string
      highlight?: string
      imageAlt?: string
      [key: string]: any
    }
    languageToggle?: {
      en?: string
      es?: string
      [key: string]: any
    }
    [key: string]: any
  }
  languageToggle?: {
    en?: string
    es?: string
    [key: string]: any
  }
  [key: string]: any
}
