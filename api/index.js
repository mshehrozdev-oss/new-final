import express from "express";
import fetch from "node-fetch";

const app = express();

const SHOP = process.env.SHOP; // e.g. "white-boutique-sa.myshopify.com"
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // Admin API access token
const REFILL_VARIANT_ID = "8084838154410";
const ELIGIBLE_TAG = "refill_eligible";

app.get("/refill/check", async (req, res) => {
  try {
    const emailRaw = (req.query.email || "").toString().trim();
    const email = emailRaw.toLowerCase();
    if (!email) return res.json({ ok: false, message: "Email is required" });

    const endpoint = `https://${SHOP}/admin/api/2025-01/graphql.json`;

    const query = `
      query($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node { id email tags }
          }
        }
      }
    `;

    const variables = { query: `email:${email}` };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const json = await r.json();
    const node = json?.data?.customers?.edges?.[0]?.node;

    if (!node) return res.json({ ok: true, eligible: false });

    const tags = Array.isArray(node.tags) ? node.tags : [];
    const eligible = tags.includes(ELIGIBLE_TAG);

    if (!eligible) return res.json({ ok: true, eligible: false });

    return res.json({
      ok: true,
      eligible: true,
      checkoutUrl: `/cart/${REFILL_VARIANT_ID}:1?checkout`
    });
  } catch (e) {
    return res.json({ ok: false, message: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("running on", PORT));