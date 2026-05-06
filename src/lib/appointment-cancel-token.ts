import { createHash, randomBytes } from "node:crypto";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function randomDigits(length: number): string {
  const max = 10 ** length;
  const n = Number.parseInt(randomBytes(6).toString("hex"), 16) % max;
  return String(n).padStart(length, "0");
}

export function generateAppointmentCancelSecret() {
  const code = randomDigits(6);
  const token = randomBytes(24).toString("hex");
  return {
    code,
    token,
    codeHash: sha256(code),
    tokenHash: sha256(token),
    codeLast4: code.slice(-4),
  };
}

export function verifyCancelCode(inputCode: string, codeHash: string | null | undefined): boolean {
  if (!codeHash) return false;
  return sha256(inputCode.trim()) === codeHash;
}

export function verifyCancelToken(inputToken: string, tokenHash: string | null | undefined): boolean {
  if (!tokenHash) return false;
  return sha256(inputToken.trim()) === tokenHash;
}
