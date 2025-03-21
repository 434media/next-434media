import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for 434 Media - The rules, guidelines, and agreements for using our services.",
  alternates: {
    canonical: "/terms-of-service",
  },
}

export default function TermsOfServicePage() {
  return (
    <>
      <main className="bg-white py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 mb-8">Terms of Service</h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-neutral-700 mb-6">
              Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p className="text-neutral-700 mb-4">
              By accessing or using the services provided by 434 Media (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms,
              please do not use our services.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">2. Description of Services</h2>
            <p className="text-neutral-700 mb-4">
              434 Media provides creative media and smart marketing solutions, including but not limited to brand
              storytelling, media strategy, video production, web development, and event production. The specific
              services provided will be outlined in separate agreements or statements of work.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">3. Use of Our Website</h2>
            <p className="text-neutral-700 mb-4">You may use our website for lawful purposes only. You agree not to:</p>
            <ul className="list-disc pl-6 mb-4 text-neutral-700">
              <li>Use our website in any way that violates applicable laws or regulations</li>
              <li>Attempt to gain unauthorized access to any part of our website</li>
              <li>Interfere with the proper functioning of our website</li>
              <li>Collect or harvest any information from our website without our permission</li>
              <li>Use our website to transmit malware, viruses, or other malicious code</li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">4. Intellectual Property</h2>
            <p className="text-neutral-700 mb-4">
              All content on our website, including text, graphics, logos, images, audio clips, digital downloads, and
              software, is the property of 434 Media or its content suppliers and is protected by United States and
              international copyright laws.
            </p>
            <p className="text-neutral-700 mb-4">
              Our trademarks and trade dress may not be used in connection with any product or service without our prior
              written consent.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">5. User Content</h2>
            <p className="text-neutral-700 mb-4">
              If you submit content to our website (such as through contact forms or comments), you grant us a
              non-exclusive, royalty-free, perpetual, irrevocable, and fully sublicensable right to use, reproduce,
              modify, adapt, publish, translate, create derivative works from, distribute, and display such content
              throughout the world in any media.
            </p>
            <p className="text-neutral-700 mb-4">
              You represent and warrant that you own or control all rights to the content you submit, that the content
              is accurate, and that use of the content does not violate these Terms of Service or cause injury to any
              person or entity.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">6. Disclaimer of Warranties</h2>
            <p className="text-neutral-700 mb-4">
              Our website and services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. 434
              Media makes no representations or warranties of any kind, express or implied, as to the operation of our
              website or the information, content, materials, or products included on our website.
            </p>
            <p className="text-neutral-700 mb-4">
              To the full extent permissible by applicable law, 434 Media disclaims all warranties, express or implied,
              including, but not limited to, implied warranties of merchantability and fitness for a particular purpose.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">7. Limitation of Liability</h2>
            <p className="text-neutral-700 mb-4">
              434 Media will not be liable for any damages of any kind arising from the use of our website or services,
              including, but not limited to, direct, indirect, incidental, punitive, and consequential damages.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">8. Indemnification</h2>
            <p className="text-neutral-700 mb-4">
              You agree to indemnify, defend, and hold harmless 434 Media, its officers, directors, employees, agents,
              and third parties, for any losses, costs, liabilities, and expenses (including reasonable attorneys&apos;
              fees) relating to or arising out of your use of our website or services, your violation of these Terms of
              Service, or your violation of any rights of another.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">9. Governing Law</h2>
            <p className="text-neutral-700 mb-4">
              These Terms of Service and any separate agreements whereby we provide you services shall be governed by
              and construed in accordance with the laws of the State of Texas, United States.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">10. Changes to Terms</h2>
            <p className="text-neutral-700 mb-4">
              We reserve the right to modify these Terms of Service at any time. We will notify you of any changes by
              posting the new Terms of Service on this page and updating the &quot;Last Updated&quot; date. Your
              continued use of our website or services after any such changes constitutes your acceptance of the new
              Terms of Service.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-4">11. Contact Information</h2>
            <p className="text-neutral-700 mb-4">
              If you have any questions about these Terms of Service, please contact us at:
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

