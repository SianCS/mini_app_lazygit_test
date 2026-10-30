import { NextResponse } from "next/server";

// Vaja รับข้อความต่อครั้งได้จำกัด เลยตัดไม่ให้ยาวเกินไป
const MAX_CHARS = 300;

// รับข้อความ → ขอให้ Vaja สังเคราะห์เสียง → ดึงไฟล์ wav แล้วส่งกลับให้หน้าเว็บ
export async function POST(req: Request) {
  const apiKey = process.env.AIFORTHAI_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า AIFORTHAI_KEY ใน .env.local" }, { status: 500 });
  }

  const { text, speaker = 1 } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "ไม่มีข้อความให้อ่าน" }, { status: 400 });
  }

  const res = await fetch("https://api.aiforthai.in.th/vaja9/synth_audiovisual", {
    method: "POST",
    headers: { Apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      input_text: text.trim().slice(0, MAX_CHARS),
      speaker: Number(speaker),
      phrase_break: 0,
      audiovisual: 0,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: `Vaja ตอบกลับ ${res.status}: ${raw}` }, { status: 502 });
  }

  let wavUrl: unknown;
  try {
    wavUrl = JSON.parse(raw).wav_url;
  } catch {
    return NextResponse.json({ error: `Vaja ตอบกลับไม่ใช่ JSON: ${raw}` }, { status: 502 });
  }
  if (typeof wavUrl !== "string") {
    return NextResponse.json({ error: `ไม่พบ wav_url ใน response: ${raw}` }, { status: 502 });
  }

  // ไฟล์เสียงต้องแนบ Apikey ตอนดาวน์โหลด เบราว์เซอร์จึงโหลดตรงไม่ได้ ต้องให้ server ดึงมาให้
  const audio = await fetch(wavUrl, { headers: { Apikey: apiKey } });
  if (!audio.ok) {
    return NextResponse.json({ error: `ดาวน์โหลดเสียงไม่สำเร็จ (${audio.status})` }, { status: 502 });
  }

  return new Response(await audio.arrayBuffer(), {
    headers: { "Content-Type": "audio/wav" },
  });
}
