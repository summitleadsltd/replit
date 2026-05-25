/**
 * Telephony service layer.
 * Active provider: LiveKit + Telnyx SIP.
 */

export interface TelephonyCallOptions {
  destinationNumber: string;
  callerNumber?: string;
}

export interface TelephonyProvider {
  readonly name: string;
  readonly connected: boolean;
  init(): Promise<void>;
  makeCall(options: TelephonyCallOptions): Promise<void>;
  hangup(): void;
  mute(): void;
  unmute(): void;
  hold(): void;
  unhold(): void;
  sendDTMF(digit: string): void;
  destroy(): void;
}

export function getProviderLabel(providerType: string): string {
  if (providerType === "livekit") return "LiveKit + Telnyx SIP";
  return providerType;
}

export function isProviderSupported(providerType: string): boolean {
  return providerType === "livekit";
}

export function getProviderRequirements(providerType: string): string[] {
  if (providerType === "livekit") {
    return ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL", "TELNYX_SIP_TRUNK_ID"];
  }
  return [];
}
