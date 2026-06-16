import { Link } from "wouter";

const EFFECTIVE_DATE = "June 16, 2026";
const CONTACT_EMAIL = "support@willapp.live";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-gray-800" data-testid="page-privacy-policy">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link href="/">
          <a className="text-sm text-brandBlue hover:underline" data-testid="link-home">
            ← Back to WILL
          </a>
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-6 leading-relaxed text-[15px]">
          <p>
            This Privacy Policy explains how WILL ("we", "us", or "our") collects,
            uses, and protects your information when you use the WILL mobile app and
            website (the "Service"). By using the Service, you agree to the practices
            described here.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Information We Collect</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>
                <strong>Account information:</strong> your email address, first and
                last name, and username, which you provide when you create an account.
              </li>
              <li>
                <strong>Content you create:</strong> your goals ("wills"), commitments,
                daily check-ins, progress notes, reviews, and messages you send within
                circles, team wills, and public wills.
              </li>
              <li>
                <strong>Subscription information:</strong> your subscription and purchase
                status. Payments are processed by Apple (in-app purchases) and Stripe
                (web). We do not collect or store your full payment card details.
              </li>
              <li>
                <strong>Device & notification data:</strong> a device push token and your
                time zone, used to send you the notifications you enable.
              </li>
              <li>
                <strong>Usage data:</strong> basic technical and usage information needed
                to operate, secure, and improve the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">How We Use Your Information</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To authenticate you and keep your account secure.</li>
              <li>To enable accountability features you choose to participate in (circles, team wills, public wills).</li>
              <li>To send notifications and reminders you have enabled.</li>
              <li>To process and verify your subscription.</li>
              <li>To respond to your requests and provide support.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">How Your Information Is Shared</h2>
            <p className="mt-3">
              We do not sell your personal information. Information is shared only in
              these limited ways:
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>
                <strong>With other members</strong> of circles, team wills, or public
                wills you join. Other members see your first name and username and the
                content you choose to share with the group. Your email address and your
                private "Because" statements are not shared with other members.
              </li>
              <li>
                <strong>With service providers</strong> who help us operate the Service,
                including Apple and Stripe (payments), RevenueCat (subscription
                management), Resend (email), Daily.co (video), and our cloud database and
                push-notification providers. These providers process data on our behalf.
              </li>
              <li>
                <strong>For legal reasons</strong> when required by law or to protect the
                rights, safety, and security of our users and the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Data Retention & Deletion</h2>
            <p className="mt-3">
              We keep your information for as long as your account is active. You can
              delete your account at any time from the account settings within the app,
              which removes your personal account data. You may also contact us to
              request deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Security</h2>
            <p className="mt-3">
              We use reasonable technical and organizational measures to protect your
              information, including encrypted passwords and secured connections. No
              method of transmission or storage is completely secure, however, and we
              cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Children's Privacy</h2>
            <p className="mt-3">
              The Service is not directed to children under 13, and we do not knowingly
              collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Changes to This Policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. When we do, we will
              update the effective date above.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>
            <p className="mt-3">
              If you have any questions about this Privacy Policy, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-brandBlue hover:underline"
                data-testid="link-contact-email"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <p className="pt-4 text-sm text-gray-500">
            See also our{" "}
            <Link href="/terms">
              <a className="text-brandBlue hover:underline" data-testid="link-terms">
                Terms of Service
              </a>
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
