// Diagnóstico — sin importaciones externas
export default function handler(req, res) {
  res.json({ pong: true, env: Boolean(process.env.TURSO_URL), time: Date.now() });
}
