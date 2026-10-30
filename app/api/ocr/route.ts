import { NextResponse } from "next/server";

// รับรูปจากหน้าเว็บ แล้วส่งต่อไปที่ AI for Thai T-OCR (key อยู่ฝั่ง server เท่านั้น)
export async function POST(req: Request) {
  const apiKey = process.env.AIFORTHAI_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า AIFORTHAI_KEY ใน .env.local" }, { status: 500 });
  }

  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
  }

  const body = new FormData();
  body.append("uploadfile", image, image.name);

  const res = await fetch("https://api.aiforthai.in.th/ocr", {
    method: "POST",
    headers: { Apikey: apiKey },
    body,
    signal: req.signal, // หน้าเว็บยกเลิก → เลิกรอ T-OCR ด้วย
  }).catch((e) => {
    if (req.signal.aborted) return null;
    throw e;
  });
  if (!res) return new Response(null, { status: 499 });

  const raw = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 429 ? "เรียกถี่เกินไป (rate limit) รอสักครู่แล้วลองใหม่"
      : res.status >= 502 ? "server ของ AI for Thai ไม่ตอบ ลองใหม่ภายหลัง"
      : `T-OCR ตอบกลับ ${res.status}: ${raw}`;
    return NextResponse.json({ error: hint }, { status: 502 });
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: `T-OCR ตอบกลับไม่ใช่ JSON: ${raw}` }, { status: 502 });
  }

  // ฟิลด์ข้อความหลักคือ "Original" — เผื่อชื่ออื่นไว้กรณี API เปลี่ยน
  const text = data.Original ?? data.text ?? data.result;
  if (typeof text !== "string") {
    return NextResponse.json({ error: "ไม่พบข้อความใน response", raw: data }, { status: 502 });
  }

  return NextResponse.json({ text: text.trim() });
}
