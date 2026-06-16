import { Link } from "wouter";

const EFFECTIVE_DATE = "June 16, 2026";
const CONTACT_EMAIL = "support@willapp.live";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white text-gray-800" data-testid="page-terms">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link href="/">
          <a className="text-sm text-brandBlue hover:underline" data-testid="link-home">
            ← Back to WILL
          </a>
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-6 leading-relaxed text-[15px]">
          <p>
            These Terms of Service ("Terms") govern your use of the WILL mobile app and
            website (the "Service"). By creating an account or using the Service, you
            agree to these Terms.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Your Account</h2>
            <p className="mt-3">
              You must provide accurate information when creating an account and are
              responsible for keeping your login credentials secure. You are responsible
              for all activity that occurs under your account. You must be at least 13
              years old to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Subscriptions & Payments</h2>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>
                WILL is offered as an auto-renewing subscription. On iOS, payment is
                charged to your Apple ID account at confirmation of purchase.
              </li>
              <li>
                Your subscription automatically renews unless you cancel it at least 24
                hours before the end of the current period. Your account is charged for
                renewal within 24 hours before the period ends.
              </li>
              <li>
                You can manage and cancel your subscription in your device's account
                settings (App Store) after purchase.
              </li>
              <li>
                If a free trial is offered, any unused portion is forfeited when you
                purchase a subscription.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Acceptable Use</h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
              <li>Harass, abuse, or harm other members.</li>
              <li>Post content that is illegal, hateful, or infringes the rights of others.</li>
              <li>Attempt to disrupt, reverse engineer, or gain unauthorized access to the Service.</li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Your Content</h2>
            <p className="mt-3">
              You retain ownership of the content you create. You grant us a limited
              license to store and display your content as needed to operate the Service,
              including sharing it with the members of circles, team wills, or public
              wills you choose to participate in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Disclaimer</h2>
            <p className="mt-3">
              The Service is provided "as is" without warranties of any kind. WILL is a
              tool to support personal accountability and goal tracking; it does not
              provide medical, mental health, legal, or professional advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Limitation of Liability</h2>
            <p className="mt-3">
              To the maximum extent permitted by law, WILL is not liable for any
              indirect, incidental, or consequential damages arising from your use of the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Changes to These Terms</h2>
            <p className="mt-3">
              We may update these Terms from time to time. When we do, we will update the
              effective date above. Continued use of the Service means you accept the
              updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>
            <p className="mt-3">
              Questions about these Terms? Contact us at{" "}
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
            <Link href="/privacy">
              <a className="text-brandBlue hover:underline" data-testid="link-privacy">
                Privacy Policy
              </a>
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
