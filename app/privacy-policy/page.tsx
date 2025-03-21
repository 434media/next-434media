import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for 434 Media - Learn how we collect, use, and protect your personal information.",
  alternates: {
    canonical: "/privacy-policy",
  },
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <main className="bg-white py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 mb-8">Privacy Policy</h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-neutral-700 mb-6">
              Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">1. Introduction</h2>
            <p className="text-neutral-700 mb-4">
              434 Media ("we," "our," or "us") respects your privacy and is committed to protecting your personal
              information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you visit our website or use our services.
            </p>
            <p className="text-neutral-700 mb-4">
              Please read this Privacy Policy carefully. By accessing or using our website or services, you acknowledge
              that you have read, understood, and agree to be bound by this Privacy Policy.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">2. Information We Collect</h2>
            <p className="text-neutral-700 mb-4">
              We may collect personal information that you voluntarily provide to us when you:
            </p>
            <ul className="list-disc pl-6 mb-4 text-neutral-700">
              <li>Subscribe to our newsletter</li>
              <li>Fill out a contact form</li>
              <li>Register for events or webinars</li>
              <li>Request information about our services</li>
              <li>Engage with us on social media</li>
            </ul>
            <p className="text-neutral-700 mb-4">The personal information we collect may include:</p>
            <ul className="list-disc pl-6 mb-4 text-neutral-700">
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Company name</li>
              <li>Job title</li>
              <li>Message content</li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <p className="text-neutral-700 mb-4">
              We may use the information we collect for various purposes, including to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-neutral-700">
              <li>Provide, maintain, and improve our services</li>
              <li>Respond to your inquiries and fulfill your requests</li>
              <li>Send you marketing communications</li>
              <li>Personalize your experience on our website</li>
              <li>Analyze usage patterns and trends</li>
              <li>Protect against, identify, and prevent fraud and other illegal activity</li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">4. Cookies and Tracking Technologies</h2>
            <p className="text-neutral-700 mb-4">
              We use cookies and similar tracking technologies to track activity on our website and collect certain
              information. Cookies are files with a small amount of data that may include an anonymous unique
              identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being
              sent.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">5. Third-Party Services</h2>
            <p className="text-neutral-700 mb-4">
              We may use third-party services, such as analytics providers and marketing platforms, that collect,
              monitor, and analyze information to help us improve our website and services. These third parties may use
              cookies, web beacons, and other technologies to collect information about your use of our website.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">6. Data Security</h2>
            <p className="text-neutral-700 mb-4">
              We implement appropriate technical and organizational measures to protect the security of your personal
              information. However, please be aware that no method of transmission over the internet or electronic
              storage is 100% secure, and we cannot guarantee absolute security.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">7. Your Rights</h2>
            <p className="text-neutral-700 mb-4">
              Depending on your location, you may have certain rights regarding your personal information, such as:
            </p>
            <ul className="list-disc pl-6 mb-4 text-neutral-700">
              <li>The right to access the personal information we have about you</li>
              <li>The right to request correction of inaccurate information</li>
              <li>The right to request deletion of your information</li>
              <li>The right to opt-out of marketing communications</li>
            </ul>
            <p className="text-neutral-700 mb-4">
              To exercise these rights, please contact us using the information provided in the "Contact Us" section
              below.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">8. Changes to This Privacy Policy</h2>
            <p className="text-neutral-700 mb-4">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy
              Policy periodically for any changes.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">9. Contact Us</h2>
            <p className="text-neutral-700 mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-neutral-700 mb-4">
              <strong>Email:</strong>{" "}
              <a href="mailto:build@434media.com" className="text-emerald-600 hover:text-emerald-700">
                build@434media.com
              </a>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-200">
            <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}

