import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalysisSchema = z.object({
  prediction: z.string(),
  confidence: z.number().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high"]),
  explanation: z.string(),
  differential: z
    .array(z.object({ name: z.string(), probability: z.number().min(0).max(100) }))
    .min(1)
    .max(5),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        urgency: z.enum(["routine", "soon", "urgent"]),
      }),
    )
    .min(1)
    .max(5),
});

const SYSTEM_PROMPT =
  "You are a dermatology image triage assistant for a clinical decision-support tool. Analyze the provided skin image and return structured findings as JSON only. Possible conditions include: Melanoma, Basal Cell Carcinoma, Squamous Cell Carcinoma, Benign Keratosis, Melanocytic Nevus, Psoriasis, Eczema, Acne, Fungal Infection, Vitiligo, Rosacea, or Normal skin. Never claim a definitive diagnosis. Always recommend in-person dermatology consultation for any suspicious lesion. Be conservative on confidence. Respond ONLY with a JSON object matching this shape: {\"prediction\":string,\"confidence\":number(0-100),\"risk_level\":\"low\"|\"medium\"|\"high\",\"explanation\":string,\"differential\":[{\"name\":string,\"probability\":number}],\"recommendations\":[{\"title\":string,\"detail\":string,\"urgency\":\"routine\"|\"soon\"|\"urgent\"}]}";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return JSON.parse(candidate.slice(start, end + 1));
}

// Helper: check if the calling user is a doctor or admin
async function isClinician(supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r: { role: string }) => r.role === "doctor" || r.role === "admin");
}

// ── Analyze a scan (patient submits, or doctor/admin can re-analyze) ──────────
export const analyzeScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI service not configured");

    const { data: scan, error: scanErr } = await supabase
      .from("scans")
      .select("id, user_id, image_path, body_location, notes")
      .eq("id", data.scanId)
      .single();
    if (scanErr || !scan) throw new Error("Scan not found");

    // Allow: scan owner OR a clinician (doctor/admin)
    const clinician = await isClinician(supabase, userId);
    if (scan.user_id !== userId && !clinician) throw new Error("Forbidden");

    await supabase.from("scans").update({ status: "analyzing" }).eq("id", scan.id);

    const { data: signed, error: urlErr } = await supabase.storage
      .from("scan-images")
      .createSignedUrl(scan.image_path, 60 * 5);
    if (urlErr || !signed?.signedUrl) throw new Error("Could not load image");

    const imgRes = await fetch(signed.signedUrl);
    if (!imgRes.ok) throw new Error("Image fetch failed");
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get("content-type") || "image/jpeg";
    let b64 = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }

    try {
      const base64Data = btoa(b64);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Analyze this skin image. ${
                      scan.body_location ? `Location: ${scan.body_location}.` : ""
                    } ${scan.notes ? `Patient notes: ${scan.notes}` : ""}`,
                  },
                  { inline_data: { mime_type: mime, data: base64Data } },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini API ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = AnalysisSchema.parse(extractJson(content));

      const { error: updErr } = await supabase
        .from("scans")
        .update({
          status: "completed",
          prediction: parsed.prediction,
          confidence: parsed.confidence,
          risk_level: parsed.risk_level,
          explanation: parsed.explanation,
          differential: parsed.differential,
          recommendations: parsed.recommendations,
        })
        .eq("id", scan.id);
      if (updErr) throw updErr;

      return { ok: true, scanId: scan.id };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      await supabase.from("scans").update({ status: "failed", explanation: msg }).eq("id", scan.id);
      throw new Error(msg);
    }
  });

// ── Doctor submits a clinical review ─────────────────────────────────────────
export const submitDoctorReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scanId: string; review: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const clinician = await isClinician(supabase, userId);
    if (!clinician) throw new Error("Forbidden: clinicians only");

    const { error } = await supabase
      .from("scans")
      .update({
        doctor_review: data.review.trim(),
        doctor_id: userId,
        reviewed_at: new Date().toISOString(),
        status: "reviewed",
      })
      .eq("id", data.scanId);

    if (error) throw error;
    return { ok: true };
  });
