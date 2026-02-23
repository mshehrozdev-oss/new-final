module.exports = async (req, res) => {
  try {
    const SHOP = process.env.SHOP || null;
    const HAS_ADMIN_TOKEN = !!process.env.ADMIN_TOKEN;

    return res.status(200).json({
      ok: true,
      mode: "health",
      message: "Function is running",
      env: {
        SHOP,
        HAS_ADMIN_TOKEN
      }
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: "Crash in test route",
      error: e?.message || String(e)
    });
  }
};