export default async function handler(req, res) {
  try {
    const SHOP = process.env.SHOP;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

    if (!SHOP) return res.status(500).json({ ok: false, message: "Missing env SHOP" });
    if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, message: "Missing env ADMIN_TOKEN" });

    const emailRaw = (req.query.email || "").toString().trim();
    const email = emailRaw.toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: "Email required" });

    const REFILL_VARIANT_ID = "8084838154410";
    const ELIGIBLE_TAG = "refill_eligible";

    const endpoint = `https://${SHOP}/admin/api/2026-01/graphql.json`;

    const query = `
      query($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { id email tags } }
        }
      }
    `;

    const variables = { query: `email:${email}` };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const json = await response.json();

    if (json.errors) {
      return res.status(500).json({ ok: false, message: "Shopify GraphQL error", errors: json.errors });
    }
  
    const customer = json?.data?.customers?.edges?.[0]?.node;
    if (!customer) return res.json({ ok: true, eligible: false, reason: "no_customer" });

    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    const eligible = tags.includes(ELIGIBLE_TAG);

    if (!eligible) return res.json({ ok: true, eligible: false, reason: "missing_tag" });

    return res.json({
      ok: true,
      eligible: true,
      checkoutUrl: `/cart/${REFILL_VARIANT_ID}:1?checkout`
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server crash",
      error: err?.message || String(err)
    });
  }
}