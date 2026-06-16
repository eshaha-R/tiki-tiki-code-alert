export type TriggerMode = "errors" | "syntaxLike";

export interface DiagnosticLike {
  severity: number;
  message: string;
  source?: string;
  code?: unknown;
}

export const DiagnosticSeverityValue = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
} as const;

const SYNTAX_PATTERNS = [
  /\bsyntax\b/i,
  /\bparse(?:r|s|d| error| errors)?\b/i,
  /\bparsing\b/i,
  /\bexpected\b/i,
  /\bmissing\b/i,
  /\bunterminated\b/i,
  /\bunexpected token\b/i,
  /\binvalid token\b/i,
  /\bend of file\b/i,
  /\beof\b/i,
  /[;,.()[\]{}] expected/i
];

export function getBlockingDiagnostics(
  diagnostics: readonly DiagnosticLike[],
  triggerMode: TriggerMode
): DiagnosticLike[] {
  return diagnostics.filter((diagnostic) => isBlockingDiagnostic(diagnostic, triggerMode));
}

export function isBlockingDiagnostic(diagnostic: DiagnosticLike, triggerMode: TriggerMode): boolean {
  if (diagnostic.severity !== DiagnosticSeverityValue.Error) {
    return false;
  }

  if (triggerMode === "syntaxLike") {
    return isSyntaxLikeDiagnostic(diagnostic);
  }

  return true;
}

export function isSyntaxLikeDiagnostic(diagnostic: DiagnosticLike): boolean {
  const codeText = stringifyDiagnosticCode(diagnostic.code);
  const haystack = `${diagnostic.source ?? ""} ${diagnostic.message ?? ""} ${codeText}`;
  return SYNTAX_PATTERNS.some((pattern) => pattern.test(haystack));
}

function stringifyDiagnosticCode(code: unknown): string {
  if (typeof code === "string" || typeof code === "number") {
    return String(code);
  }

  if (code && typeof code === "object" && "value" in code) {
    const value = (code as { value?: unknown }).value;
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  }

  return "";
}
