import test from "node:test";
import assert from "node:assert/strict";
import {
  DiagnosticSeverityValue,
  getBlockingDiagnostics,
  isBlockingDiagnostic,
  isSyntaxLikeDiagnostic
} from "../diagnostics";

test("errors mode blocks error diagnostics", () => {
  const diagnostic = {
    severity: DiagnosticSeverityValue.Error,
    message: "Cannot find name 'foo'."
  };

  assert.equal(isBlockingDiagnostic(diagnostic, "errors"), true);
});

test("errors mode ignores warnings", () => {
  const diagnostic = {
    severity: DiagnosticSeverityValue.Warning,
    message: "Unused variable."
  };

  assert.equal(isBlockingDiagnostic(diagnostic, "errors"), false);
});

test("syntaxLike mode blocks parser-looking errors", () => {
  const diagnostic = {
    severity: DiagnosticSeverityValue.Error,
    source: "typescript",
    message: "',' expected."
  };

  assert.equal(isSyntaxLikeDiagnostic(diagnostic), true);
  assert.equal(isBlockingDiagnostic(diagnostic, "syntaxLike"), true);
});

test("syntaxLike mode ignores non-parser-looking errors", () => {
  const diagnostic = {
    severity: DiagnosticSeverityValue.Error,
    message: "Type 'string' is not assignable to type 'number'."
  };

  assert.equal(isBlockingDiagnostic(diagnostic, "syntaxLike"), false);
});

test("filters mixed diagnostics", () => {
  const diagnostics = [
    { severity: DiagnosticSeverityValue.Information, message: "Info" },
    { severity: DiagnosticSeverityValue.Warning, message: "Warning" },
    { severity: DiagnosticSeverityValue.Error, message: "Missing initializer." },
    { severity: DiagnosticSeverityValue.Error, message: "Cannot find module." }
  ];

  assert.equal(getBlockingDiagnostics(diagnostics, "errors").length, 2);
  assert.equal(getBlockingDiagnostics(diagnostics, "syntaxLike").length, 1);
});
