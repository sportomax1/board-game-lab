export default function handler(req, res) {
  // Return password from Vercel environment variable
  res.status(200).send(process.env.PASSWORD || '');
}
