import { Resend } from "resend";
import User from "@/models/User";
import AppSetting from "@/models/AppSetting";
import { GLOBAL_SETTINGS_KEY, normalizeEmailList } from "@/lib/app-settings";

const STOCK_ALERT_LEVEL = 5;

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function getDirectorEmails(): Promise<string[]> {
  const directors = await User.find({ role: "directeur" }).select("email").lean();
  return directors.map((u) => u.email).filter(Boolean);
}

async function getConfiguredLowStockEmails(): Promise<string[]> {
  const settings = await AppSetting.findOne({ key: GLOBAL_SETTINGS_KEY })
    .select("lowStockAlertEmails")
    .lean();

  const configuredEmails = normalizeEmailList(settings?.lowStockAlertEmails);
  if (configuredEmails.length > 0) return configuredEmails;
  return getDirectorEmails();
}

async function sendResendLowStock(productName: string, stock: number): Promise<void> {
  const resend = resendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resend || !fromEmail) {
    console.warn("[stock-alerts] Resend non configuré (RESEND_API_KEY ou RESEND_FROM_EMAIL manquant)");
    return;
  }

  const fromName = process.env.SMTP_FROM_NAME ?? "e-Restaurant";
  const from = `${fromName} <${fromEmail}>`;
  const to = await getConfiguredLowStockEmails();
  if (to.length === 0) {
    console.warn("[stock-alerts] Aucun utilisateur avec le rôle directeur pour l’envoi email");
    return;
  }

  const subject = `[e-Restaurant] Stock faible : ${productName}`;
  const html = `
    <p>Bonjour,</p>
    <p>Après une vente clôturée, le produit <strong>${escapeHtml(productName)}</strong> est à <strong>${stock}</strong> unité(s) en stock (seuil d’alerte : 5 ou moins).</p>
    <p>Pensez à réapprovisionner.</p>
  `;

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("[stock-alerts] Resend:", error);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * WhatsApp — par ordre de priorité si configuré :
 * 1. Meta Cloud API (WHATSAPP_CLOUD_ACCESS_TOKEN, WHATSAPP_CLOUD_PHONE_NUMBER_ID)
 * 2. Twilio (TWILIO_*)
 * 3. CallMeBot (CALLMEBOT_API_KEY) — https://www.callmebot.com/
 *
 * Destinataire : WHATSAPP_ALERT_PHONE (indicatif pays + numéro, chiffres uniquement après nettoyage).
 */
async function sendWhatsAppLowStock(productName: string, stock: number): Promise<void> {
  const phone = process.env.WHATSAPP_ALERT_PHONE?.replace(/\D/g, "") ?? "";
  const text = `e-Restaurant — Stock faible (≤5)\n${productName} : ${stock} unité(s) restantes après vente.`;

  const cloudToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const cloudPhoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
  const cloudVersion = (process.env.WHATSAPP_CLOUD_API_VERSION ?? "v21.0").trim();

  if (cloudToken && cloudPhoneNumberId && phone) {
    const url = `https://graph.facebook.com/${cloudVersion}/${cloudPhoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloudToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error("[stock-alerts] WhatsApp Cloud API HTTP", res.status, raw);
    } else {
      try {
        const j = JSON.parse(raw) as { messages?: Array<{ id?: string }> };
        const wamid = j.messages?.[0]?.id;
        if (wamid) console.log("[stock-alerts] WhatsApp Cloud API message_id:", wamid);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (twilioSid && twilioToken && twilioFrom && phone) {
    const body = new URLSearchParams({
      From: twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`,
      To: `whatsapp:+${phone}`,
      Body: text,
    });
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    if (!res.ok) {
      console.error("[stock-alerts] Twilio WhatsApp:", await res.text());
    }
    return;
  }

  const callmeKey = process.env.CALLMEBOT_API_KEY;
  if (callmeKey && phone) {
    const url = new URL("https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", phone);
    url.searchParams.set("apikey", callmeKey);
    url.searchParams.set("text", text);
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("[stock-alerts] CallMeBot:", await res.text());
    }
    return;
  }

  console.warn(
    "[stock-alerts] WhatsApp non configuré : Cloud API (WHATSAPP_CLOUD_ACCESS_TOKEN + WHATSAPP_CLOUD_PHONE_NUMBER_ID + WHATSAPP_ALERT_PHONE), ou Twilio (TWILIO_*), ou CallMeBot (CALLMEBOT_API_KEY)."
  );
}

const LOW_STOCK_MAX = STOCK_ALERT_LEVEL;

/**
 * Après chaque vente clôturée : alerte si le stock du produit est ≤ 5 (y compris rupture à 0).
 */
export async function notifyLowStockAfterSaleIfNeeded(input: {
  productName: string;
  stockAfterSale: number;
}): Promise<void> {
  const { productName, stockAfterSale } = input;
  if (stockAfterSale > LOW_STOCK_MAX) {
    return;
  }

  await Promise.all([
    sendResendLowStock(productName, stockAfterSale).catch((e) => console.error("[stock-alerts] email", e)),
    sendWhatsAppLowStock(productName, stockAfterSale).catch((e) => console.error("[stock-alerts] whatsapp", e)),
  ]);
}
