import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { useAuth } from "@/lib/auth";
import { Send, MessageSquare, Plus, X, User, Stethoscope, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/messages")({ component: MessagesPage });

interface Conversation {
  id: string; user_id: string; subject: string; created_at: string; last_message_at: string;
}
interface Message {
  id: string; conversation_id: string; sender_id: string; body: string;
  image_url: string | null; created_at: string;
}

function MessagesPage() {
  const { roles } = useAuth();
  const isClinician = roles.includes("doctor") || roles.includes("admin");
  return isClinician ? <ClinicianInbox /> : <PatientInbox />;
}

// -- Shared inbox shell --------------------------------------------------------
function InboxShell({
  conversations, isLoading, activeId, setActiveId,
  userId, isClinician, onNewConversation, showNew, setShowNew,
}: {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  userId: string;
  isClinician: boolean;
  onNewConversation: (id: string) => void;
  showNew: boolean;
  setShowNew: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const active = conversations?.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Sidebar — hidden on mobile when a conversation is open */}
      <aside className={`${(activeId || showNew) ? "hidden sm:flex" : "flex"} w-full sm:w-72 border-r border-border bg-white flex-col shrink-0`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-clinical-blue">
              {isClinician ? "Patient inbox" : "Inbox"}
            </p>
            <h1 className="font-bold text-base">Messages</h1>
          </div>
          {!isClinician && (
            <button onClick={() => setShowNew(true)}
              className="size-8 flex items-center justify-center rounded-xl bg-clinical-blue text-white hover:bg-clinical-blue/90 transition-all"
              title="New conversation">
              <Plus className="size-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : conversations && conversations.length > 0 ? (
            conversations.map((c) => (
              <button key={c.id}
                onClick={() => { setActiveId(c.id); setShowNew(false); }}
                className={`w-full text-left px-4 py-3.5 border-b border-border transition-all duration-150 ${
                  activeId === c.id ? "bg-clinical-blue/8 border-l-2 border-l-clinical-blue" : "hover:bg-secondary/60"
                }`}>
                <div className="flex items-center gap-2 mb-0.5">
                  {isClinician && (
                    <div className="size-5 rounded-full bg-clinical-blue/15 flex items-center justify-center shrink-0">
                      <User className="size-3 text-clinical-blue" />
                    </div>
                  )}
                  <div className="font-semibold text-sm truncate">{c.subject}</div>
                </div>
                {isClinician && (
                  <div className="text-[10px] font-mono text-muted-foreground truncate ml-7">
                    Patient: {c.user_id.slice(0, 10)}…
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5 ml-7">
                  {new Date(c.last_message_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            ))
          ) : (
            <div className="p-6 text-center">
              <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                {isClinician ? <Stethoscope className="size-5 text-muted-foreground" /> : <MessageSquare className="size-5 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {isClinician ? "No patient messages yet." : <>No conversations yet.<br />Start one with the + button.</>}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main panel — hidden on mobile when nothing is open */}
      <div className={`${!activeId && !showNew ? "hidden sm:flex" : "flex"} flex-1 flex-col overflow-hidden bg-clinical-bg`}>
        {showNew && !isClinician ? (
          <NewConversationPanel userId={userId}
            onClose={() => setShowNew(false)}
            onCreated={(id) => {
              qc.invalidateQueries({ queryKey: ["conversations"] });
              onNewConversation(id);
              setShowNew(false);
            }} />
        ) : active ? (
          <ChatPanel conversation={active} userId={userId} isClinician={isClinician}
            onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-clinical-blue/10 to-clinical-blue/5 flex items-center justify-center mb-4">
              {isClinician ? <Stethoscope className="size-7 text-clinical-blue/60" /> : <MessageSquare className="size-7 text-clinical-blue/60" />}
            </div>
            <div className="font-semibold text-sm mb-1">
              {isClinician ? "Select a patient conversation" : "No conversation selected"}
            </div>
            <div className="text-xs text-muted-foreground max-w-[200px]">
              {isClinician ? "Patient messages appear here when they send you a message." : "Select a conversation or start a new one."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Patient inbox -------------------------------------------------------------
function PatientInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", "patient", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*")
        .eq("user_id", user!.id).order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    // Auto-select first conversation on desktop only
    const isDesktop = window.innerWidth >= 640;
    if (!activeId && conversations && conversations.length > 0 && isDesktop) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  return (
    <InboxShell conversations={conversations} isLoading={isLoading}
      activeId={activeId} setActiveId={setActiveId}
      userId={user!.id} isClinician={false}
      showNew={showNew} setShowNew={setShowNew}
      onNewConversation={(id) => {
        qc.invalidateQueries({ queryKey: ["conversations", "patient", user?.id] });
        setActiveId(id);
      }} />
  );
}

// -- Clinician inbox -----------------------------------------------------------
function ClinicianInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", "clinician"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase.channel("clinician-inbox-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" },
        () => { qc.invalidateQueries({ queryKey: ["conversations", "clinician"] }); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" },
        () => { qc.invalidateQueries({ queryKey: ["conversations", "clinician"] }); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["conversations", "clinician"] });
          qc.invalidateQueries({ queryKey: ["messages"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  useEffect(() => {
    const isDesktop = window.innerWidth >= 640;
    if (!activeId && conversations && conversations.length > 0 && isDesktop) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  return (
    <InboxShell conversations={conversations} isLoading={isLoading}
      activeId={activeId} setActiveId={setActiveId}
      userId={user!.id} isClinician={true}
      showNew={false} setShowNew={() => {}}
      onNewConversation={() => {}} />
  );
}

// -- Chat panel ----------------------------------------------------------------
function ChatPanel({
  conversation, userId, isClinician, onBack,
}: {
  conversation: Conversation; userId: string; isClinician: boolean; onBack?: () => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*")
        .eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const channel = supabase.channel(`messages:${conversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conversation.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", conversation.id] });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pickImage = (file: File | null) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };
  const clearImage = () => {
    setImageFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("message-images").upload(path, file, { contentType: file.type });
    setUploadingImage(false);
    if (error) { toast.error("Image upload failed"); return null; }
    const { data } = supabase.storage.from("message-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text && !imageFile) return;
    setSending(true);
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (!imageUrl) { setSending(false); return; }
    }
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id, sender_id: userId,
      body: text || (imageUrl ? "" : ""), image_url: imageUrl,
    });
    if (!error) {
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
    }
    setSending(false);
    if (error) { toast.error("Failed to send message"); }
    else {
      setBody(""); clearImage();
      qc.invalidateQueries({ queryKey: ["messages", conversation.id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const isClinicianSender = (m: Message) => m.sender_id !== conversation.user_id;

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-border px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onBack?.()} aria-label="Back"
            className="sm:hidden size-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary transition-colors shrink-0">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${isClinician ? "bg-risk-low/10" : "bg-clinical-blue/10"}`}>
            {isClinician ? <User className="size-4 text-risk-low" /> : <Stethoscope className="size-4 text-clinical-blue" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{conversation.subject}</div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {isClinician
                ? `Patient: ${conversation.user_id.slice(0, 12)}… · Started ${new Date(conversation.created_at).toLocaleDateString()}`
                : `Started ${new Date(conversation.created_at).toLocaleDateString()}`}
            </div>
          </div>
          {isClinician && (
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-risk-low bg-risk-low/10 border border-risk-low/20 px-2.5 py-1 rounded-lg shrink-0">
              <Stethoscope className="size-3" /> Clinician view
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-gradient-to-b from-clinical-bg to-clinical-bg/80">
        {messages && messages.length > 0 ? (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            const fromClinician = isClinicianSender(m);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <div className={`size-7 rounded-xl flex items-center justify-center text-[10px] font-bold mr-2 shrink-0 mt-1 ${fromClinician ? "bg-risk-low/15 text-risk-low" : "bg-clinical-blue/10 text-clinical-blue"}`}>
                    {fromClinician ? "Dr" : "P"}
                  </div>
                )}
                <div className={`max-w-[80%] sm:max-w-[65%] rounded-2xl text-sm overflow-hidden shadow-sm ${
                  mine ? "bg-gradient-to-br from-clinical-blue to-clinical-blue/90 text-white rounded-br-sm"
                       : "bg-white border border-border text-foreground rounded-bl-sm"
                }`}>
                  {m.image_url && (
                    <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                      <img src={m.image_url} alt="attachment" className="max-w-full max-h-64 object-cover w-full" loading="lazy" />
                    </a>
                  )}
                  {m.body && <div className="px-4 py-2.5"><p className="leading-relaxed">{m.body}</p></div>}
                  <div className={`px-4 pb-2 text-[10px] ${mine ? "text-white/50 text-right" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-xs text-muted-foreground py-12">
            <MessageSquare className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            No messages yet. Send the first one below.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="bg-white border-t border-border px-4 pt-3 flex items-start gap-3">
          <div className="relative">
            <img src={imagePreview} alt="preview" className="h-20 w-20 object-cover rounded-lg border border-border" />
            <button type="button" onClick={clearImage}
              className="absolute -top-2 -right-2 size-5 bg-foreground text-white rounded-full flex items-center justify-center hover:bg-risk-high">
              <X className="size-3" />
            </button>
          </div>
          <div className="text-xs text-muted-foreground pt-1">
            <div className="font-medium">{imageFile?.name}</div>
            <div>{imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}</div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={send} className="bg-white border-t border-border px-3 sm:px-4 py-3 flex gap-2 items-end shrink-0">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="size-10 flex items-center justify-center border border-border rounded-xl text-muted-foreground hover:text-clinical-blue hover:border-clinical-blue hover:bg-clinical-blue/5 transition-all shrink-0">
          <ImageIcon className="size-4" />
        </button>
        <textarea
          className="flex-1 resize-none border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue/25 focus:border-clinical-blue/50 min-h-[42px] max-h-32 transition-all"
          placeholder={isClinician ? "Reply to patient…" : "Type a message…"}
          rows={1} value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e as unknown as React.FormEvent); }
          }} />
        <button type="submit" disabled={sending || uploadingImage || (!body.trim() && !imageFile)}
          className="size-10 flex items-center justify-center bg-clinical-blue text-white rounded-xl hover:bg-clinical-blue/90 hover:shadow-sm disabled:opacity-40 transition-all shrink-0">
          {sending || uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </>
  );
}

// -- New conversation panel ----------------------------------------------------
function NewConversationPanel({
  userId, onClose, onCreated,
}: { userId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !firstMessage.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { data: conv, error: convErr } = await supabase.from("conversations")
      .insert({ user_id: userId, subject: subject.trim(), last_message_at: now })
      .select().single();
    if (convErr || !conv) { setSaving(false); return toast.error("Failed to create conversation"); }
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conv.id, sender_id: userId, body: firstMessage.trim(),
    });
    setSaving(false);
    if (msgErr) { toast.error("Message failed to send"); }
    else { toast.success("Message sent to your clinician"); }
    onCreated(conv.id);
  };

  return (
    <div className="flex-1 flex flex-col p-5 sm:p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onClose}
          className="sm:hidden size-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary transition-colors shrink-0">
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-bold text-lg">New message</h2>
        <button onClick={onClose}
          className="hidden sm:flex ml-auto size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary transition-colors">
          <X className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-6">Your message will be visible to all clinicians on the platform.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Subject</label>
          <input className="input-base" placeholder="e.g. Question about my scan results"
            value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Message</label>
          <textarea className="input-base resize-none" rows={5}
            placeholder="Describe your concern or question…"
            value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} required />
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Sending…" : "Send message"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
