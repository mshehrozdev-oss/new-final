module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    ok: true,
    service: "refill-backend",
    time: new Date().toISOString()
  });
};