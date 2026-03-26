export function nhlUrl(path) {
  const raw = `https://api-web.nhle.com${path}`
  return `https://iajs-cors.rchrd2.workers.dev/${raw}`
}
