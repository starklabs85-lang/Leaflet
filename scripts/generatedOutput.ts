export function generatedOutputMatches(current: string, generated: string) {
  return normalizeLineEndings(current) === normalizeLineEndings(generated);
}

function normalizeLineEndings(value: string) {
  return value.replaceAll("\r\n", "\n");
}
