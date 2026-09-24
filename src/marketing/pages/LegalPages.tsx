import { DATASET_TTL_DAYS } from "../../resources/store";
import { DISPLAY_NAME, SITE_DOMAIN } from "../brand";
import { Hero } from "../components/Hero";
import { renderPage } from "../Layout";

/**
 * Privacy policy and terms for the hosted product. Google's OAuth review
 * reads the privacy policy against what the app actually does, so every
 * claim here has to stay true to the code: cache lifetimes
 * (src/domains/gsc/*), export expiry (DATASET_TTL_DAYS), what DataForSEO
 * receives (tool arguments only), no trackers. Change them together.
 */
const CONTACT_EMAIL = `hello@${SITE_DOMAIN}`;
const EFFECTIVE_DATE = "25 September 2026";
const GOOGLE_USER_DATA_POLICY = "https://developers.google.com/terms/api-services-user-data-policy";

function Contact() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

function PrivacyPage() {
  return (
    <>
      <Hero eyebrow="Legal" heading="Privacy policy" lede={`Effective ${EFFECTIVE_DATE}. What ${DISPLAY_NAME} Cloud collects, why, and what we never do with it.`} />

      <section class="legal">
        <p>
          This policy covers {DISPLAY_NAME} Cloud, the hosted service at {SITE_DOMAIN} ("we", "us"). {DISPLAY_NAME} is also open-source
          software: if you run your own copy, you're the operator of that copy and this policy doesn't apply to it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address and sign-in method, handled by our sign-in provider, Clerk.
          </li>
          <li>
            <strong>Websites you add:</strong> each site's name and domain, and the Search Console and Google Analytics properties you
            link to it.
          </li>
          <li>
            <strong>Google data you connect:</strong> covered in detail in the next section.
          </li>
          <li>
            <strong>API keys:</strong> we store only a one-way hash of each key, never the key itself.
          </li>
          <li>
            <strong>Usage records:</strong> which tools were called and when, the cost of each paid market-data call, and daily call
            counts, used for quotas, billing and preventing abuse.
          </li>
          <li>
            <strong>Billing:</strong> your plan, subscription status, payment-provider customer id and wallet transactions. Card details
            go straight to our payment provider, Dodo Payments, and never reach us.
          </li>
          <li>
            <strong>Team invites:</strong> the email address of each person you invite.
          </li>
          <li>
            <strong>Technical data:</strong> our hosting provider, Cloudflare, processes IP addresses and request details to deliver and
            protect the service.
          </li>
        </ul>

        <h2>Google user data</h2>
        <p>
          When you connect Google, you choose which access to grant. We request read-only access, and only what each feature needs:
        </p>
        <ul>
          <li>
            <strong>Search Console</strong> (<code>webmasters.readonly</code>): search performance, URL indexing status and sitemaps for
            the properties you own.
          </li>
          <li>
            <strong>Google Analytics</strong> (<code>analytics.readonly</code>): reports for your GA4 properties, and the list of those
            properties so you can pick one.
          </li>
          <li>
            <strong>Your Google email address</strong> (<code>openid email</code>): to show which Google account is connected.
          </li>
        </ul>
        <p>
          <strong>How we use it.</strong> Only to answer the requests you, or the AI assistant you connect with your API key, make
          through {DISPLAY_NAME}. We fetch it when you ask for it and return it to you.
        </p>
        <p>
          <strong>How long we keep it.</strong>
        </p>
        <ul>
          <li>Your Google access tokens are stored until you disconnect Google or delete your account.</li>
          <li>Search Console responses are cached for between 1 and 6 hours, so repeated identical questions don't re-query Google.</li>
          <li>Google Analytics responses aren't stored.</li>
          <li>
            When a Search Console result is too large to return at once, the full result is kept for {DATASET_TTL_DAYS} days so your
            assistant can download it, then deleted.
          </li>
          <li>We don't keep any other copy of your Google data.</li>
        </ul>
        <p>
          <strong>What we never do with it.</strong> We don't sell it. We don't use it for advertising. We don't use it to develop,
          improve or train AI or machine-learning models. We don't share it with anyone except to deliver it to you. People at{" "}
          {DISPLAY_NAME} don't read it, unless you ask us to (for example, to help with a support request), or it's needed for
          security or to comply with the law.
        </p>
        <p>
          <strong>Limited Use.</strong> {DISPLAY_NAME}'s use and transfer of information received from Google APIs to any other app
          will adhere to the <a href={GOOGLE_USER_DATA_POLICY}>Google API Services User Data Policy</a>, including the Limited Use
          requirements.
        </p>
        <p>
          <strong>Removing access.</strong> Disconnect Google anytime from Settings in your dashboard, which deletes the stored tokens.
          You can also revoke access from your{" "}
          <a href="https://myaccount.google.com/permissions">Google Account permissions page</a>.
        </p>

        <h2>Your AI assistant</h2>
        <p>
          Results go to the MCP client you connect with your API key, such as Claude or Cursor. Once there, that client's provider
          handles them under its own privacy policy, which you choose and control.
        </p>

        <h2>Who we share data with</h2>
        <p>Only the service providers that run parts of {DISPLAY_NAME}, each for its own purpose:</p>
        <ul>
          <li>
            <strong>Cloudflare:</strong> hosting, database and file storage.
          </li>
          <li>
            <strong>Clerk:</strong> sign-in and account management.
          </li>
          <li>
            <strong>Dodo Payments:</strong> payments, as our merchant of record.
          </li>
          <li>
            <strong>xmit.sh</strong> (sending through Amazon SES): account and billing emails.
          </li>
          <li>
            <strong>DataForSEO:</strong> paid market data. It receives the keywords, domains and URLs your requests ask about, never your
            Google data.
          </li>
          <li>
            <strong>Google Fonts:</strong> loads the fonts on our pages, so Google sees your IP address when you visit.
          </li>
        </ul>
        <p>We don't sell personal data. We may disclose data where the law requires it.</p>

        <h2>Cookies</h2>
        <p>
          We use only the cookies needed to keep you signed in, set by us and Clerk. No advertising or analytics trackers.
        </p>

        <h2>Retention and deletion</h2>
        <p>
          We keep account data while your account is open. To delete your account and its data, email <Contact />. We'll do it within
          30 days, except records we must keep by law, such as billing records.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, export or delete your personal data, or object to how we use it, by emailing <Contact />.
          Depending on where you live, you may also be able to complain to a data protection authority.
        </p>

        <h2>Security</h2>
        <p>
          Everything is served over HTTPS. API keys and invite links are stored only as one-way hashes. Google access is read-only and
          limited to what each feature needs.
        </p>

        <h2>Children</h2>
        <p>{DISPLAY_NAME} isn't meant for anyone under 16, and we don't knowingly collect their data.</p>

        <h2>Changes</h2>
        <p>
          If we change this policy, we'll update the date above. For significant changes, we'll also email account holders before they
          take effect.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy: <Contact />.
        </p>
      </section>
    </>
  );
}

function TermsPage() {
  return (
    <>
      <Hero eyebrow="Legal" heading="Terms of service" lede={`Effective ${EFFECTIVE_DATE}. The rules for using ${DISPLAY_NAME} Cloud.`} />

      <section class="legal">
        <p>
          These terms cover {DISPLAY_NAME} Cloud, the hosted service at {SITE_DOMAIN} ("we", "us"). By creating an account or using the
          service, you agree to them. The {DISPLAY_NAME} source code is separately available under the MIT license; these terms cover
          only the hosted service, not the code.
        </p>

        <h2>The service</h2>
        <p>
          {DISPLAY_NAME} Cloud gives AI assistants access to SEO data through the Model Context Protocol: your own Google Search Console
          and Analytics data, and on paid plans, market data such as keyword, backlink and search-results data.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Keep your sign-in and API keys secure. You're responsible for activity under your account and keys.</li>
          <li>Only connect Google properties and websites you're authorized to access.</li>
          <li>On a Team plan, the workspace owner manages billing and members, and is responsible for the people they invite.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>Don't use the service to:</p>
        <ul>
          <li>break the law or anyone else's rights;</li>
          <li>get around plan limits, rate limits or quotas, or share an account to do so;</li>
          <li>resell or redistribute the market data as a standalone dataset;</li>
          <li>disrupt, overload, probe or attack the service.</li>
        </ul>
        <p>We may suspend accounts that do.</p>

        <h2>Plans and payment</h2>
        <ul>
          <li>
            Paid plans are billed monthly in advance and renew automatically until cancelled. Our merchant of record, Dodo Payments,
            processes payments.
          </li>
          <li>You can cancel anytime from Billing. When the cancellation takes effect, your workspace moves to the Free plan.</li>
          <li>
            Wallet top-ups are prepaid credit for market data used beyond your plan's included amount. They aren't cash and can't be
            transferred. A wallet balance is kept if you downgrade, and can be used again if you resubscribe.
          </li>
          <li>We may change prices; we'll email you before a change affects your plan.</li>
        </ul>

        <h2>Data and accuracy</h2>
        <p>
          Market data comes from third-party sources and is an estimate. Search Console and Analytics data comes from Google. We pass
          both on as we receive them, labelled with their source and confidence, but we can't guarantee they're complete or accurate.
          How we handle your data is covered in our <a href="/privacy">privacy policy</a>.
        </p>

        <h2>Availability and changes</h2>
        <p>
          We work to keep the service running, but don't guarantee it will be uninterrupted or error-free. We may change, add or remove
          features.
        </p>

        <h2>Ending your use</h2>
        <p>
          You can stop using the service and delete your account at any time. We may suspend or end access for serious or repeated
          breaches of these terms.
        </p>

        <h2>Disclaimer and liability</h2>
        <p>
          The service is provided "as is", without warranties of any kind, to the extent the law allows. To the extent the law allows,
          we're not liable for indirect or consequential losses, and our total liability is limited to what you paid us in the 12
          months before the claim.
        </p>

        <h2>Changes to these terms</h2>
        <p>If we change these terms, we'll update the date above and email account holders about significant changes.</p>

        <h2>Contact</h2>
        <p>
          Questions: <Contact />.
        </p>
      </section>
    </>
  );
}

export function renderPrivacy(canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  return renderPage({
    title: `Privacy policy · ${DISPLAY_NAME}`,
    description: `How ${DISPLAY_NAME} Cloud handles your data, including Google Search Console and Analytics data.`,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <PrivacyPage />
  });
}

export function renderTerms(canonicalUrl: string, cloudMode: boolean, signedIn = false): string {
  return renderPage({
    title: `Terms of service · ${DISPLAY_NAME}`,
    description: `The terms for using ${DISPLAY_NAME} Cloud.`,
    canonicalUrl,
    cloudMode,
    signedIn,
    children: <TermsPage />
  });
}
