"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mic, MicOff, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createCapture } from "@/app/b/[bid]/capture/actions";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

/** Downscale on-device so a 4 MB camera photo uploads as ~250 KB on a slow network. */
async function shrink(file: File, maxSide = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
  return blob ? new File([blob], "capture.jpg", { type: "image/jpeg" }) : file;
}

export function CaptureComposer({ businessId, locale = "en-NG" }: { businessId: string; locale?: string }) {
  const [state, action, pending] = useActionState(createCapture, null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [channel, setChannel] = useState<"text" | "voice">("text");
  const [listening, setListening] = useState(false);
  const [clientRef, setClientRef] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => setClientRef(crypto.randomUUID()), []);
  useEffect(() => {
    if (state?.ok) {
      setText("");
      setPhoto(null);
      setChannel("text");
      setClientRef(crypto.randomUUID());
    }
  }, [state]);

  function toggleVoice() {
    if (listening) return recognition.current?.stop();
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = locale;
    r.interimResults = true;
    r.continuous = true;
    const before = text ? `${text} ` : "";
    r.onresult = (e) => {
      const said = Array.from(e.results, (res) => res[0]?.transcript ?? "").join(" ");
      setText(before + said);
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    setChannel("voice");
    setListening(true);
    r.start();
  }

  return (
    <form
      action={async (fd) => {
        if (photo) fd.set("photo", await shrink(photo));
        return action(fd);
      }}
      className="glass space-y-3 p-4"
    >
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="clientRef" value={clientRef} />
      <label htmlFor="capture-text" className="sr-only">What happened in the business?</label>
      <Textarea
        id="capture-text"
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Say or type what happened, e.g. "Sold 2 bags of rice at 45k each to Mama Bisi, cash"'}
        className="min-h-28 border-none bg-transparent text-base focus-visible:ring-0"
        maxLength={4000}
      />
      {photo && (
        <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
          <span className="truncate">📷 {photo.name}</span>
          <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)}><X className="size-4" /></button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {speechSupported && (
          <Button type="button" variant={listening ? "destructive" : "outline"} size="icon" onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak"}>
            {listening ? <MicOff /> : <Mic />}
          </Button>
        )}
        <Button type="button" variant="outline" size="icon" onClick={() => fileInput.current?.click()} aria-label="Add a photo of a receipt or notebook">
          <Camera />
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">{listening ? "Listening…" : ""}</span>
        <Button disabled={pending || (!text.trim() && !photo)}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Record
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
