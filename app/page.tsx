"use client";

import { useRef, useState } from "react";

const SPEAKERS = [
    { id: 1, label: "เสียง 1" },
    { id: 2, label: "เสียง 2" },
    { id: 3, label: "เสียง 3" },
    { id: 4, label: "เสียง 4" },
];

// T-OCR รับเฉพาะ jpg/png ขนาดไม่เกิน 1 MB — แปลงรูปเป็น JPEG แล้วย่อจนกว่าจะเล็กพอ
async function compressImage(file: File, maxBytes = 1_000_000): Promise<File> {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    let quality = 0.9;

    for (let i = 0; i < 8; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff"; // พื้นหลังขาวกันรูป png โปร่งใสกลายเป็นสีดำ
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", quality));
        if (blob.size <= maxBytes) return new File([blob], "image.jpg", { type: "image/jpeg" });

        if (quality > 0.6) quality -= 0.15;
        else scale *= 0.8;
    }
    throw new Error("ย่อรูปให้ต่ำกว่า 1 MB ไม่ได้ ลองครอปรูปให้เล็กลง");
}

export default function Home() {
    const [preview, setPreview] = useState<string | null>(null);
    const [text, setText] = useState("");
    const [speaker, setSpeaker] = useState(1);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<"ocr" | "tts" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const ocrRequest = useRef<AbortController | null>(null);

    // ยกเลิก OCR ที่ค้างอยู่ (T-OCR บางครั้งค้างเป็นนาที) — ผลของรูปเก่าจะได้ไม่เด้งกลับมา
    function cancelOcr() {
        ocrRequest.current?.abort();
        ocrRequest.current = null;
        setLoading((l) => (l === "ocr" ? null : l));
    }

    function removeImage() {
        cancelOcr();
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setError(null);
        // ล้างค่าใน input ด้วย ไม่งั้นเลือกไฟล์เดิมซ้ำแล้ว onChange จะไม่ทำงาน
        if (fileInput.current) fileInput.current.value = "";
    }

    async function handleImage(file: File) {
        cancelOcr();
        const controller = new AbortController();
        ocrRequest.current = controller;

        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(file));
        setAudioUrl(null);
        setError(null);
        setLoading("ocr");
        try {
            const form = new FormData();
            form.append("image", await compressImage(file));
            const res = await fetch("/api/ocr", { method: "POST", body: form, signal: controller.signal });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            // แทนที่ข้อความเดิมเฉพาะตอนอ่านได้จริง ถ้า OCR พลาด ข้อความที่พิมพ์ไว้ยังอยู่
            if (data.text) setText(data.text);
            else setError("อ่านข้อความจากรูปไม่ได้ ลองรูปที่ชัดกว่านี้");
        } catch (e) {
            if (controller.signal.aborted) return; // ผู้ใช้ลบ/เปลี่ยนรูปเอง ไม่ใช่ error
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (ocrRequest.current === controller) {
                ocrRequest.current = null;
                setLoading(null);
            }
        }
    }

    async function speak() {
        setError(null);
        setLoading("tts");
        try {
            const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, speaker }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(URL.createObjectURL(await res.blob()));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(null);
        }
    }

    const overLimit = text.length > 300;

    return (
        <main className="min-h-screen bg-gradient-to-b from-teal-50 to-background px-4 py-10 dark:from-teal-950/40">
            <div className="mx-auto max-w-2xl space-y-6">
                <header className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-2xl shadow-lg shadow-teal-600/30">
                        🔊
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">อ่านออกเสียงภาษาไทย</h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        พิมพ์หรือสแกนข้อความ แล้วให้ AI อ่านให้ฟัง
                    </p>
                    <div className="mt-3 flex justify-center gap-2 text-xs">
                        <span className="rounded-full bg-teal-100 px-3 py-1 font-medium text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                            Vaja · Text-to-Speech
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            T-OCR · อ่านข้อความจากรูป
                        </span>
                    </div>
                </header>

                {/* การ์ด 1: ข้อความ */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-3 flex items-center gap-2 font-semibold">
                        <StepBadge n={1} /> ข้อความ
                    </h2>

                    {/* lock ระหว่าง OCR เพราะผลที่ได้จะมาแทนที่ข้อความ — readOnly ยังเลือก/copy ได้ */}
                    <div className="relative">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            readOnly={loading === "ocr"}
                            rows={6}
                            placeholder="พิมพ์ข้อความที่ต้องการให้อ่าน..."
                            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 leading-relaxed outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15 read-only:cursor-not-allowed read-only:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-950"
                        />
                        {loading === "ocr" && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-teal-700 shadow dark:bg-slate-900/90 dark:text-teal-300">
                                    <Spinner /> กำลังอ่านข้อความจากรูป...
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                            {loading === "ocr" ? "กด ✕ บนรูปเพื่อยกเลิกแล้วพิมพ์เอง" : "แก้ไขข้อความได้ก่อนกดอ่าน"}
                        </span>
                        <span className={overLimit ? "font-medium text-amber-600" : "text-slate-400"}>
                            {text.length}/300{overLimit && " · เกินจะถูกตัด"}
                        </span>
                    </div>

                    {/* OCR เป็นตัวเสริม: ถ้า server ของ T-OCR ล่ม แอปยังใช้งานได้ด้วยการพิมพ์ */}
                    <details className="group mt-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <span>📷 หรือสแกนข้อความจากรูป</span>
                            <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
                        </summary>

                        <div className="space-y-3 px-4 pb-4">
                            {preview ? (
                                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={preview} alt="รูปที่เลือก" className="mx-auto max-h-72 object-contain" />
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        aria-label="ลบรูป"
                                        className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-red-600"
                                    >
                                        ✕ ลบรูป
                                    </button>
                                </div>
                            ) : (
                                <label
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragging(true);
                                    }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragging(false);
                                        const file = e.dataTransfer.files[0];
                                        if (file?.type.startsWith("image/")) handleImage(file);
                                    }}
                                    className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragging
                                            ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40"
                                            : "border-slate-300 hover:border-teal-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                                        }`}
                                >
                                    <span className="text-3xl">🖼️</span>
                                    <span className="text-sm font-medium">คลิกเพื่อเลือก/ถ่ายรูป หรือลากรูปมาวาง</span>
                                    <span className="text-xs text-slate-500">JPG, PNG · ระบบย่อขนาดให้อัตโนมัติ</span>
                                    <input
                                        ref={fileInput}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
                                        className="sr-only"
                                    />
                                </label>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                ข้อความที่อ่านได้จะถูกใส่ในช่องด้านบน แก้ไขได้ก่อนกดอ่านออกเสียง
                            </p>
                        </div>
                    </details>
                </section>

                {/* การ์ด 2: เสียง */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-3 flex items-center gap-2 font-semibold">
                        <StepBadge n={2} /> อ่านออกเสียง
                    </h2>

                    <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">เลือกเสียง</p>
                    <div className="mb-4 grid grid-cols-4 gap-2">
                        {SPEAKERS.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSpeaker(s.id)}
                                className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${speaker === s.id
                                        ? "border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20 dark:bg-teal-950/50 dark:text-teal-200"
                                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={speak}
                        disabled={!text.trim() || loading !== null}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                        {loading === "tts" ? (
                            <>
                                <Spinner /> กำลังสร้างเสียง...
                            </>
                        ) : (
                            "🔊 อ่านออกเสียง"
                        )}
                    </button>

                    {audioUrl && (
                        <audio src={audioUrl} controls autoPlay className="mt-4 w-full" />
                    )}
                </section>

                {error && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                    >
                        <span>⚠️</span>
                        <p className="flex-1">{error}</p>
                        <button type="button" onClick={() => setError(null)} aria-label="ปิด" className="opacity-60 hover:opacity-100">
                            ✕
                        </button>
                    </div>
                )}

                <footer className="pt-2 text-center text-xs text-slate-400">
                    Powered by AI for Thai (NECTEC)
                </footer>
            </div>
        </main>
    );
}

function StepBadge({ n }: { n: number }) {
    return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
            {n}
        </span>
    );
}

function Spinner() {
    return (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
    );
}
