// Comprehensive type definitions for the dictionary

// Define the recursive type for dictionary values
type DictionaryValue = string | number | boolean | Record<string, unknown> | DictionaryValue[] | undefined

export interface Dictionary {
  common?: {
    learnMore?: string
    viewAll?: string
    submit?: string
    loading?: string
    error?: string
    success?: string
    language?: string
    [key: string]: DictionaryValue
  }
  navigation?: {
    home?: string
    about?: string
    services?: string
    portfolio?: string
    contact?: string
    blog?: string
    [key: string]: DictionaryValue
  }
  home?: {
    hero?: {
      title?: string
      subtitle?: string
      cta?: string
      [key: string]: DictionaryValue
    }
    services?: {
      title?: string
      subtitle?: string
      items?: {
        [key: string]: {
          title?: string
          description?: string
          [key: string]: DictionaryValue
        }
      }
      [key: string]: DictionaryValue
    }
    about?: {
      title?: string
      content?: string
      [key: string]: DictionaryValue
    }
    contact?: {
      title?: string
      subtitle?: string
      form?: {
        name?: string
        email?: string
        message?: string
        submit?: string
        [key: string]: DictionaryValue
      }
      [key: string]: DictionaryValue
    }
    [key: string]: DictionaryValue
  }
  sdoh?: {
    title?: string
    subtitle?: string
    intro1?: string
    intro2Part1?: string
    intro2Part2?: string
    sdohFull?: string
    heroAlt?: string
    hero?: {
      title?: string
      subtitle?: string
      cta?: string
      [key: string]: DictionaryValue
    }
    mission?: {
      title?: string
      content?: string
      partnershipTitle?: string
      codeComment?: string
      description1?: string
      description2?: string
      hashtags?: string
      [key: string]: DictionaryValue
    }
    features?: {
      title?: string
      items?: {
        [key: string]: {
          title?: string
          description?: string
          [key: string]: DictionaryValue
        }
      }
      [key: string]: DictionaryValue
    }
    newsletter?: {
      title?: string
      subtitle?: string
      placeholder?: string
      submit?: string
      success?: string
      error?: string
      [key: string]: DictionaryValue
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
      [key: string]: DictionaryValue
    }
    accelerator?: {
      title?: string
      subtitle?: string
      description1?: string
      description2?: string
      [key: string]: DictionaryValue
    }
    demoDay?: {
      title?: string
      description?: string
      loadingText?: string
      errorTitle?: string
      errorMessage?: string
      learnMore?: string
      [key: string]: DictionaryValue
    }
    impact?: {
      question?: string
      message?: string
      conclusion?: string
      [key: string]: DictionaryValue
    }
    partnership?: {
      label?: string
      title?: string
      description?: string
      velocityAlt?: string
      methodistAlt?: string
      [key: string]: DictionaryValue
    }
    seminar?: {
      title?: string
      description1?: string
      description2?: string
      description2End?: string
      causa?: string
      highlight?: string
      imageAlt?: string
      [key: string]: DictionaryValue
    }
    languageToggle?: {
      en?: string
      es?: string
      [key: string]: DictionaryValue
    }
    sessions?: {
      viewSession?: string
      comingSoon?: string
      comingSoonDescription?: string
      visitWebsite?: string
      downloadSlides?: string
      close?: string
      sessionId?: string
      card1?: {
        title?: string
        description?: string
      }
      card2?: {
        title?: string
        description?: string
      }
      card3?: {
        title?: string
        description?: string
      }
    }
    [key: string]: DictionaryValue
  }
  languageToggle?: {
    en?: string
    es?: string
    [key: string]: DictionaryValue
  }
  [key: string]: DictionaryValue
}
