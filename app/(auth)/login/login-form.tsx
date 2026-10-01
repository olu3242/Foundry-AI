"use client";

import { useActionState, useState } from "react";
import { Phone, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { sendEmailLink, sendPhoneOtp, verifyPhoneOtp } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [sendState, send, sending] = useActionState(sendPhoneOtp, null);
  const [verifyState, verify, verifying] = useActionState(verifyPhoneOtp, null);
  const [emailState, sendEmail, emailing] = useActionState(sendEmailLink, null);
  const phone = sendState?.ok ? (sendState.data?.phone ?? "") : "";

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["phone", "email"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium aria-selected:bg-surface aria-selected:shadow-glass"
          >
            {m === "phone" ? <Phone className="size-4" aria-hidden /> : <Mail className="size-4" aria-hidden />}
            {m === "phone" ? "Phone" : "Email"}
          </button>
        ))}
      </div>

      {mode === "phone" && !phone && (
        <form action={send} className="space-y-3">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+233 20 000 0001" required />
          <FormMessage state={sendState} field="phone" />
          <Button className="w-full" disabled={sending}>
            {sending && <Loader2 className="animate-spin" />} Send code
          </Button>
        </form>
      )}

      {mode === "phone" && phone && (
        <form action={verify} className="space-y-3">
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="next" value={next} />
          <Label htmlFor="token">Code sent to +{phone}</Label>
          <Input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required autoFocus />
          <FormMessage state={verifyState} field="token" />
          <Button className="w-full" disabled={verifying}>
            {verifying && <Loader2 className="animate-spin" />} Verify and continue
          </Button>
        </form>
      )}

      {mode === "email" && (
        <form action={sendEmail} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FormMessage state={emailState} field="email" />
          <Button className="w-full" disabled={emailing}>
            {emailing && <Loader2 className="animate-spin" />} Email me a sign-in link
          </Button>
        </form>
      )}
    </div>
  );
}
