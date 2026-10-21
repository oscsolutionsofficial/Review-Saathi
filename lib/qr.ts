import QRCode from "qrcode";

export async function createReviewQrDataUrl(slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return QRCode.toDataURL(`${baseUrl}/r/${slug}`, { width: 1024, margin: 2, errorCorrectionLevel: "H", color: { dark: "#075f62", light: "#ffffff" } });
}
