const crypto = require("crypto");

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify Shopify App Proxy HMAC signature.
 * Shopify sends query params including: hmac, signature (legacy), timestamp, path_prefix, shop, etc.
 * We must:
 *  1) remove hmac + signature
 *  2) sort params lexicographically
 *  3) build message "key=value&key=value..."
 *  4) compute HMAC-SHA256 using APP_PROXY_SECRET
 *  5) compare with provided hmac
 */
function verifyShopifyProxyHmac(req, secret) {
  const { hmac, signature, ...rest } = req.query || {};
  if (!hmac) return { ok: false, reason: "Missing hmac" };

  // Build message from remaining query params
  const keys = Object.keys(rest).sort();
  const message = keys
    .map((k) => `${k}=${Array.isArray(rest[k]) ? rest[k].join(",") : rest[k]}`)
    .join("&");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  // Use timing-safe compare
  const valid = timingSafeEqual(digest, String(hmac));
  return valid ? { ok: true } : { ok: false, reason: "Invalid hmac" };
}

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");

    // Basic anti-caching for eligibility (optional; you can cache short if you want)
    res.setHeader("Cache-Control", "no-store");

    const SHOP = process.env.SHOP;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    const APP_PROXY_SECRET = process.env.APP_PROXY_SECRET;

    if (!SHOP) return res.status(500).json({ ok: false, message: "Missing env SHOP" });
    if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, message: "Missing env ADMIN_TOKEN" });
    if (!APP_PROXY_SECRET) return res.status(500).json({ ok: false, message: "Missing env APP_PROXY_SECRET" });

    // ✅ Verify Shopify App Proxy signature so only Shopify can call this through /apps/...
    const hmacCheck = verifyShopifyProxyHmac(req, APP_PROXY_SECRET);
    if (!hmacCheck.ok) {
      return res.status(401).json({ ok: false, message: "Unauthorized", reason: hmacCheck.reason });
    }

    // (Optional) shop allowlist check: ensures request shop matches env SHOP
    const requestShop = (req.query.shop || "").toString().toLowerCase();
    if (requestShop && requestShop !== SHOP.toLowerCase()) {
      return res.status(401).json({ ok: false, message: "Unauthorized shop" });
    }

    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: "Email required" });

    // Config
    const REFILL_VARIANT_ID = "8084838154410";
    const ELIGIBLE_TAG = "refill_eligible";

    const endpoint = `https://${SHOP}/admin/api/2026-01/graphql.json`;

    const query = `
      query($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
              tags
            }
          }
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN
      },
      body: JSON.stringify({
        query,
        variables: { query: `email:${email}` }
      })
    });

    // If Shopify responds non-200, surface safely
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return res.status(502).json({
        ok: false,
        message: "Shopify Admin API request failed",
        status: response.status,
        body: bodyText.slice(0, 500)
      });
    }

    const json = await response.json();

    if (json.errors) {
      return res.status(500).json({ ok: false, message: "GraphQL error", errors: json.errors });
    }

    const customer = json?.data?.customers?.edges?.[0]?.node;

    if (!customer) return res.json({ ok: true, eligible: false });

    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    const eligible = tags.some((t) => String(t).toLowerCase() === ELIGIBLE_TAG);

    if (!eligible) return res.json({ ok: true, eligible: false });

    return res.json({
      ok: true,
      eligible: true,
      checkoutUrl: `/cart/${REFILL_VARIANT_ID}:1?checkout`
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server crash",
      error: err?.message || "Unknown error"
    });
  }
};