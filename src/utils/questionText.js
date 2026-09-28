// ---------------------------------------------------------------------------
// Quiz question text -> display blocks.
//
// Quiz questions may now span multiple lines and contain code. The raw string
// (with its \n line breaks and indentation) is what gets stored and sent by
// the server; this helper only decides HOW to draw it.
//
//   * Single-line text (no "\n")            -> one plain text block, exactly
//                                              like before.
//   * ```lang ... ``` fenced regions        -> code blocks (explicit).
//   * Unfenced multi-line text              -> code-looking runs of lines
//                                              (indented lines, `for x in y:`,
//                                              `int x = 5;`, `{`, `}` ...) are
//                                              drawn as code; the rest is
//                                              prose that keeps its line breaks.
//
// Pure functions, no React — so they can be unit-tested with plain Node.
// ---------------------------------------------------------------------------

const FENCE_RE = /^\s*```\s*([\w+#.-]*)\s*$/;

// Lines that are clearly code even without indentation.
const CODE_LINE_PATTERNS = [
  /[;{}]\s*$/, // C-family statement / block ends
  /^\s*(def|class)\s+\w+.*:\s*$/, // python def / class
  /^\s*(for|while|if|elif|else if|with|except)\b.*:\s*$/, // python blocks ...
  /^\s*(else|try|finally|do)\s*:?\s*\{?\s*$/, // else: / try: / do {
  /^\s*#\s*include\b/, // C preprocessor
  /^\s*(import|from)\s+[\w.*]+(\s+import\s+.+|\s+as\s+\w+)?\s*;?\s*$/, // imports
  /^\s*(public|private|protected|static|final|void|int|char|float|double|long|short|bool|boolean|unsigned|const|let|var|function|return|print|printf|println|cout|cin|scanf|String|System\.)\b.*[(;={]/, // typed decls / calls
  /^\s*[A-Za-z_][\w.]*\([^)]*\)\s*;?\s*$/, // bare call: print(i)
  /^\s*[A-Za-z_][\w.\[\]]*\s*(?:[-+*/%&|^]|\*\*|\/\/|<<|>>)?=(?!=)\s*\S/, // assignment
  /^\s*(\/\/|\/\*|\*\/)/, // comments
];
// Only counted as code when they continue a code run (a lone ")" or "# x"
// in the middle of prose is more likely prose).
const CODE_CONTINUATION_PATTERNS = [/^\s*[)\]}]/, /^\s*#/, /^\s*\*/];

const INDENTED_RE = /^(\t| {2,})\S/;
// Prose-looking indentation (a bullet/number) should not flip a line to code.
const LIST_MARKER_RE = /^\s*(?:[-*•]|\d+[.)])\s+[A-Za-z]/;

export function isCodeLine(line, prevWasCode = false) {
  if (!line.trim()) return false;
  if (LIST_MARKER_RE.test(line)) return false;
  if (INDENTED_RE.test(line)) return true;
  if (CODE_LINE_PATTERNS.some((re) => re.test(line))) return true;
  return prevWasCode && CODE_CONTINUATION_PATTERNS.some((re) => re.test(line));
}

// Splits ```-fenced regions from everything else. An unclosed fence runs to
// the end of the text (so a half-typed question still renders sensibly).
function splitFences(lines) {
  const parts = [];
  let buf = [];
  let inFence = false;
  let lang = '';
  const flush = (type) => {
    if (buf.length || type === 'code') parts.push({ type, lines: buf, lang: type === 'code' ? lang : '' });
    buf = [];
  };
  for (const line of lines) {
    const m = FENCE_RE.exec(line);
    if (m && !inFence) {
      flush('text');
      inFence = true;
      lang = m[1] || '';
    } else if (m && inFence && !m[1]) {
      flush('code');
      inFence = false;
      lang = '';
    } else {
      buf.push(line);
    }
  }
  flush(inFence ? 'code' : 'text');
  return parts;
}

// Groups unfenced lines into code / prose runs.
function splitHeuristic(lines) {
  const kinds = [];
  let prevCode = false;
  for (const line of lines) {
    const code = isCodeLine(line, prevCode);
    kinds.push(line.trim() ? (code ? 'code' : 'text') : 'blank');
    if (line.trim()) prevCode = code;
  }
  // A blank line between two code lines stays inside the code block.
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] !== 'blank') continue;
    let a = i - 1;
    while (a >= 0 && kinds[a] === 'blank') a--;
    let b = i + 1;
    while (b < kinds.length && kinds[b] === 'blank') b++;
    if (a >= 0 && b < kinds.length && kinds[a] === 'code' && kinds[b] === 'code') kinds[i] = 'code';
  }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const type = kinds[i] === 'code' ? 'code' : 'text';
    const last = out[out.length - 1];
    if (last && last.type === type) last.lines.push(lines[i]);
    else out.push({ type, lines: [lines[i]], lang: '' });
  }
  return out;
}

const trimBlankEdges = (lines) => {
  let s = 0;
  let e = lines.length;
  while (s < e && !lines[s].trim()) s++;
  while (e > s && !lines[e - 1].trim()) e--;
  return lines.slice(s, e);
};

/**
 * @returns {{type: 'text'|'code', content: string, lang: string}[]}
 * Line breaks, spaces and indentation inside every block are untouched.
 */
export function parseQuestionText(raw) {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n');
  if (!text.includes('\n')) return [{ type: 'text', content: text, lang: '' }];

  const blocks = [];
  for (const part of splitFences(text.split('\n'))) {
    if (part.type === 'code') {
      blocks.push({ type: 'code', content: part.lines.join('\n'), lang: part.lang });
    } else {
      for (const run of splitHeuristic(part.lines)) {
        const lines = run.type === 'text' ? trimBlankEdges(run.lines) : trimBlankEdges(run.lines);
        if (lines.length) blocks.push({ type: run.type, content: lines.join('\n'), lang: '' });
      }
    }
  }
  return blocks.length ? blocks : [{ type: 'text', content: text, lang: '' }];
}

/** True when the text needs more than a single plain <p> to display. */
export function isMultiLineQuestion(raw) {
  return String(raw ?? '').includes('\n');
}
