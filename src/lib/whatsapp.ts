export async function sendWhatsAppMessage(
  to: string,
  body: string,
  phoneNumberId?: string,
  accessToken?: string
) {
  const pid = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${pid}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("WhatsApp send error:", data);
    return { error: data };
  }

  return data;
}
