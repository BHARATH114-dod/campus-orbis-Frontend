import { parseQuestionText, isMultiLineQuestion } from '../../utils/questionText';

// Displays a quiz question. Single-line questions render as the same plain
// <p> they always did. Multi-line questions keep every line break, space and
// indentation: prose uses pre-wrap, code uses a monospace block that scrolls
// sideways on narrow screens instead of re-wrapping (re-wrapping would make
// indentation misleading).
export default function QuestionText({ text, className = '' }) {
  if (!isMultiLineQuestion(text)) {
    return <p className={className}>{text}</p>;
  }
  const blocks = parseQuestionText(text);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <div key={i} className="max-w-full">
            {b.lang && (
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-light">{b.lang}</span>
            )}
            <pre
              className="max-w-full overflow-x-auto rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px] font-normal leading-relaxed text-ink sm:text-sm"
              style={{ tabSize: 4, whiteSpace: 'pre' }}
            >
              <code>{b.content}</code>
            </pre>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">{b.content}</p>
        )
      )}
    </div>
  );
}
