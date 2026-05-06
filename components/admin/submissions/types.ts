// Shared types for the submissions page surface and its tab components.
// Per-tab row types (EmailSignup, ContactFormSubmission, EventRegistration)
// live with their respective tab files since they're only consumed there.

export interface Toast {
  message: string
  type: "success" | "error"
}
