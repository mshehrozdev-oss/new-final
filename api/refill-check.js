module.exports = async (req, res) => {
  try {
    const SHOP = process.env.SHOP;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

    if (!SHOP) return res.status(500).json({ ok: false, message: "Missing env SHOP" });
    if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, message: "Missing env ADMIN_TOKEN" });

    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: "Email required" });

    // ✅ Your refill variant id
    const REFILL_VARIANT_ID = "8084838154410";

    // ✅ Customer tag that means eligible
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

    const json = await response.json();

    // Shopify GraphQL errors
    if (json.errors) {
      return res.status(500).json({
        ok: false,
        message: "Shopify GraphQL error",
        errors: json.errors
      });
    }

    const customer = json?.data?.customers?.edges?.[0]?.node;

    // No customer found
    if (!customer) {
      return res.json({ ok: true, eligible: false, reason: "customer_not_found" });
    }

    const tags = Array.isArray(customer.tags) ? customer.tags : [];
    const eligible = tags.includes(ELIGIBLE_TAG);

    if (!eligible) {
      return res.json({ ok: true, eligible: false, reason: "missing_tag" });
    }

    // Eligible -> return checkout url
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
};