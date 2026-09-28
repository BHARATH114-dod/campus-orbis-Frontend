import { useEffect, useRef } from 'react';
import QuestionText from './QuestionText';
import { isMultiLineQuestion } from '../../utils/questionText';

const MAX_HEIGHT_PX = 320;

// Multi-line question field for the quiz creator. A real <textarea>, so
// pasted code keeps its newlines and indentation exactly; it grows with its
// content (up to a cap, then scrolls) and works with touch keyboards.
export default function QuestionEditor({ value, onChange, placeholder = 'Question text' }) {
  const ref = useRef(null);
  // After Esc, Tab moves focus normally (keyboard users must not get trapped).
  const tabMovesFocus = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const replaceRange = (start, end, insert, caretOffset) => {
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const pos = start + (caretOffset ?? insert.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      tabMovesFocus.current = true;
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (tabMovesFocus.current) {
        tabMovesFocus.current = false;
        return;
      }
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = e.target;
      replaceRange(s, en, '    ');
      return;
    }
    tabMovesFocus.current = false;
  };

  const insertCodeBlock = () => {
    const el = ref.current;
    const s = el ? el.selectionStart : value.length;
    const en = el ? el.selectionEnd : value.length;
    const selected = value.slice(s, en);
    const lead = s > 0 && value[s - 1] !== '\n' ? '\n' : '';
    const insert = `${lead}\`\`\`\n${selected}\n\`\`\`\n`;
    replaceRange(s, en, insert, lead.length + 4 + selected.length);
  };

  return (
    <div className="mb-2">
      <textarea
        ref={ref}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        wrap="soft"
        style={{ maxHeight: MAX_HEIGHT_PX, tabSize: 4 }}
        // text-base on phones: anything under 16px makes iOS zoom on focus.
        className="block w-full resize-y overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-paper px-3 py-2 font-mono text-base leading-relaxed sm:text-sm"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] text-ink-light">
          Multiple lines supported — paste code as-is. Press Esc then Tab to leave the box.
        </p>
        <button type="button" onClick={insertCodeBlock} className="text-[11px] font-semibold text-hero-primary hover:underline">
          {'{ }'} Code block
        </button>
      </div>
      {isMultiLineQuestion(value) && value.trim() && (
        <div className="mt-2 rounded-lg border border-dashed border-line p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-light">Preview — what students see</p>
          <QuestionText text={value} className="text-sm text-ink" />
        </div>
      )}
    </div>
  );
}
