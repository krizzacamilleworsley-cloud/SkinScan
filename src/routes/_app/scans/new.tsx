import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { analyzeScan } from "@/lib/scans.functions";
import { Disclaimer } from "@/components/scan-ui";
import { toast } from "sonner";
import { Upload, Loader2, X, ImageIcon, MapPin, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/scans/new")({ component: NewScan });

function NewScan() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const analyze    = useServerFn(analyzeScan);
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [notes, setNotes]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [stage, setStage]       = useState<"upload" | "analyzing">("upload");
  const [dragOver, setDragOver] = useState(false);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file || !user) return;
    setBusy(true);
    setStage("analyzing");
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: upErr } = await supabase.storage.from("scan-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: scan, error: insErr } = await supabase.from("scans")
        .insert({ user_id: user.id, image_path: path, body_location: location || null, notes: notes || null, status: "analyzing" })
        .select("id").single();
      if (insErr) throw insErr;
      await analyze({ data: { scanId: scan.id } });
      toast.success("Analysis complete");
      navigate({ to: "/scans/$scanId", params: { scanId: scan.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
      setBusy(false);
      setStage("upload");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-clinical-blue mb-1">New analysis</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New skin scan</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload a clear photo of the skin area for AI analysis.</p>
      </div>

      <Disclaimer className="mb-6" />

      {stage === "analyzing" ? (
        <div className="bg-white border border-border rounded-2xl p-10 sm:p-16 text-center shadow-sm">
          <div className="relative size-32 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg">
            {preview && <img src={preview} alt="" className="size-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-clinical-blue/40 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-clinical-blue to-transparent scan-line" />
          </div>
          <div className="flex items-center justify-center gap-2.5 text-sm font-semibold mb-2">
            <Loader2 className="size-4 animate-spin text-clinical-blue" />
            AI analysis in progress…
          </div>
          <p className="text-xs text-muted-foreground">Powered by Gemini 2.5 Flash · Usually takes 5–10 seconds.</p>
          <div className="mt-6 flex justify-center gap-1.5">
            {[0,1,2].map((i) => (
              <div key={i} className="size-1.5 rounded-full bg-clinical-blue/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Upload area */}
          <div className="lg:col-span-7">
            <label
              className={`block bg-white border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-clinical-blue bg-clinical-blue/5 shadow-md shadow-clinical-blue/10"
                  : "border-border hover:border-clinical-blue/50 hover:bg-clinical-blue/3"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files[0] ?? null); }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-xl shadow-sm" />
                  <button type="button" onClick={(e) => { e.preventDefault(); pick(null); }}
                    className="absolute top-2 right-2 size-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                    <X className="size-3.5" />
                  </button>
                  <p className="text-xs text-muted-foreground mt-3">{file?.name} · {file ? `${(file.size / 1024).toFixed(0)} KB` : ""}</p>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <div className="size-14 rounded-2xl bg-clinical-blue/8 flex items-center justify-center mx-auto mb-4">
                    <Upload className="size-6 text-clinical-blue/60" />
                  </div>
                  <div className="font-semibold text-sm text-foreground mb-1">Drop image or click to upload</div>
                  <div className="text-xs text-muted-foreground">JPG · PNG · WEBP · Max 10 MB</div>
                </div>
              )}
            </label>
          </div>

          {/* Details panel */}
          <div className="lg:col-span-5 bg-white border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-sm">Scan details</h2>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                <MapPin className="size-3 text-clinical-blue" /> Body location
              </label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. left forearm, upper back" className="input-base" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                <FileText className="size-3 text-clinical-blue" /> Notes (optional)
              </label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                placeholder="When did you first notice it? Any changes in size, color, or shape?"
                className="input-base resize-none" />
            </div>

            <button onClick={submit} disabled={!file || busy} className="btn-primary w-full justify-center">
              {busy ? (
                <><Loader2 className="size-4 animate-spin" /> Analyzing…</>
              ) : (
                <><ImageIcon className="size-4" /> Run AI analysis</>
              )}
            </button>

            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Results are for clinical decision support only. Not a medical diagnosis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
