const ELISION_AT_END = /[\p{L}\p{M}]['’]$/u;

export function endsWithFrenchElision(text: string) {
  return ELISION_AT_END.test(text.trimEnd());
}

/** Prevents the browser from separating an elided prefix from its word. */
export function protectFrenchElisionBreaks(text: string) {
  if (/^['’]$/u.test(text)) return `\u2060${text}\u2060`;
  return text.replace(/([\p{L}\p{M}]['’])(?=\s*$)/gu, "$1\u2060");
}
