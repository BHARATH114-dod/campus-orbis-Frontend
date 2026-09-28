import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { indentUnit } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { keymap, EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

// Language-aware setup for Campus Orbis' coding-test editor.
//
// Each language package below (lang-python / lang-cpp / lang-java /
// lang-javascript) ships its own indentation service, so the editor is
// naturally language-aware without any custom logic here:
//   - Python: indentation is syntactically meaningful. Pressing Enter after
//     a line ending in ":" increases the indent for the next line; the
//     Python language package tracks colon/indent state on its own, so C-
//     style "{}" rules are never forced onto Python code.
//   - C / C++ / Java / JavaScript: "{}" defines blocks. Pressing Enter
//     inside an open "{" auto-indents the new line, and typing "}" that
//     closes an already-indented block dedents it appropriately. Plain
//     indentation is for readability only in these languages, exactly as
//     it should be, and Python-style colon rules are never applied here.
//
// closeBrackets() (from @codemirror/autocomplete) gives smart bracket/quote
// pairing for (), {}, [], "", '' in every language, and skips over an
// already-typed closing character instead of inserting a duplicate.
// indentWithTab makes Tab indent (and Shift-Tab dedent) the current
// selection instead of moving focus, without breaking existing structure.
const LANGUAGE_EXTENSION = {
  python: () => python(),
  c: () => cpp(),
  cpp: () => cpp(),
  java: () => java(),
  javascript: () => javascript(),
};

/**
 * Smart, IDE-like code editor for coding-test questions. Drop-in
 * replacement for a plain <textarea>: same controlled value/onChange
 * contract, but with syntax highlighting, automatic indentation, bracket
 * pairing, and language-aware block handling for Python, C, C++, Java, and
 * JavaScript.
 *
 * @param {{ value: string, onChange: (code: string) => void, language: string, minHeight?: string, readOnly?: boolean }} props
 */
export default function CodeEditor({ value, onChange, language, minHeight = '100%', readOnly = false }) {
  const langExtension = useMemo(() => (LANGUAGE_EXTENSION[language] || LANGUAGE_EXTENSION.python)(), [language]);

  const extensions = useMemo(() => [
    langExtension,
    // Two-space indent is a comfortable default across all five languages;
    // students can still type Tab for a literal indent step at any point.
    indentUnit.of('  '),
    closeBrackets(),
    keymap.of([...closeBracketsKeymap, indentWithTab]),
    EditorView.lineWrapping,
  ], [langExtension]);

  return (
    <CodeMirror
      value={value}
      height="100%"
      minHeight={minHeight}
      theme={oneDark}
      extensions={extensions}
      onChange={(val) => onChange(val)}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        tabSize: 2,
      }}
      className="h-full flex-1 overflow-auto text-[13px] [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
    />
  );
}
