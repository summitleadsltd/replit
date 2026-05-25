import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Delete, X, Hash } from "lucide-react";
import { normalizePhoneToE164 } from "@/lib/phone";

interface Props {
  onDial: (e164: string, raw: string) => void;
  disabled: boolean;
  disabledReason?: string;
  onDtmf?: (digit: string) => void;
  dtmfEnabled?: boolean;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export default function DialPad({ onDial, disabled, disabledReason, onDtmf, dtmfEnabled }: Props) {
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dtmfMode, setDtmfMode] = useState(false);

  const appendDigit = useCallback((d: string) => {
    setNumber((prev) => prev + d);
    setError(null);
  }, []);

  const backspace = useCallback(() => {
    setNumber((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setNumber("");
    setError(null);
  }, []);

  const handleDial = useCallback(() => {
    const trimmed = number.trim();
    if (!trimmed) { setError("Enter a phone number"); return; }
    const result = normalizePhoneToE164(trimmed);
    if (!result.valid) { setError(result.error || "Invalid number"); return; }
    onDial(result.e164, trimmed);
    setError(null);
  }, [number, onDial]);

  // Auto-close DTMF mode when call ends
  useEffect(() => {
    if (!dtmfEnabled) setDtmfMode(false);
  }, [dtmfEnabled]);

  // Keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^[0-9*#]$/.test(e.key)) appendDigit(e.key);
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Enter" && !disabled && number.trim()) handleDial();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [appendDigit, backspace, handleDial, disabled, number]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Manual Dial</CardTitle>
          {onDtmf && (
            <Button
              variant={dtmfMode ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setDtmfMode(!dtmfMode)}
              disabled={!dtmfEnabled}
              title={dtmfEnabled ? "Toggle DTMF keypad" : "DTMF available during active call"}
            >
              <Hash className="w-3 h-3" /> DTMF
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {dtmfMode && dtmfEnabled ? (
          <>
            <p className="text-xs text-muted-foreground text-center">Send tones to navigate IVR menus</p>
            <div className="grid grid-cols-3 gap-1.5">
              {KEYS.map((row) =>
                row.map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="h-10 text-base font-medium"
                    onClick={() => onDtmf?.(key)}
                  >
                    {key}
                  </Button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-1">
              <Input
                value={number}
                onChange={(e) => { setNumber(e.target.value); setError(null); }}
                placeholder="+1 (555) 123-4567"
                className="font-mono text-center text-base"
              />
              {number && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={clear} title="Clear">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            {disabled && disabledReason && <p className="text-xs text-amber-400 text-center">{disabledReason}</p>}

            <div className="grid grid-cols-3 gap-1.5">
              {KEYS.map((row) =>
                row.map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="h-10 text-base font-medium"
                    onClick={() => appendDigit(key)}
                  >
                    {key}
                  </Button>
                ))
              )}
            </div>

            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="flex-1" onClick={backspace} disabled={!number}>
                <Delete className="w-4 h-4 mr-1" /> Delete
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={handleDial}
                disabled={disabled || !number.trim()}
              >
                <Phone className="w-4 h-4 mr-1" /> Call
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
