import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import CodeEditor from '../components/tests/CodeEditor';
import { runPracticeCode, fetchPracticeFiles, fetchPracticeFile, savePracticeFile, deletePracticeFile } from '../services/practiceService';
import { COURSE_LANGUAGES } from '../services/coursesService';

const DEFAULT_CODE = {
  python: 'print("Hello, World!")\n',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  javascript: 'console.log("Hello, World!");\n',
};

/**
 * Practice — spec §16-25: 20% language panel | 40% editor | 40% output on
 * desktop, intelligently stacked on mobile. Reuses the existing CodeEditor
 * component and the existing compiler engine (POST /api/practice/run ->
 * prepareSubmission/Judge0, same as everywhere else in the app). No second
 * compiler, no second editor.
 */
export default function Practice() {
  const { showToast } = useToast();
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(DEFAULT_CODE.python);
  const [savedCode, setSavedCode] = useState(DEFAULT_CODE.python); // last run/loaded state, for unsaved-changes detection
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [runError, setRunError] = useState(null);
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState([]);
  const [fileName, setFileName] = useState('untitled');
  const [pendingAction, setPendingAction] = useState(null); // { type, payload } — deferred until unsaved-changes prompt is resolved

  const hasUnsavedChanges = code !== savedCode;
  const meta = COURSE_LANGUAGES.find((l) => l.value === language);

  useEffect(() => { loadFiles(); }, []);

  function loadFiles() {
    fetchPracticeFiles().then((res) => setFiles(res.files)).catch(() => {});
  }

  function doSwitchLanguage(lang) {
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang] || '');
    setSavedCode(DEFAULT_CODE[lang] || '');
    setFileName('untitled');
    setOutput(null);
    setRunError(null);
  }

  function doNewFile() {
    setCode(DEFAULT_CODE[language] || '');
    setSavedCode(DEFAULT_CODE[language] || '');
    setFileName('untitled');
    setOutput(null);
    setRunError(null);
  }

  async function doOpenFile(id) {
    try {
      const res = await fetchPracticeFile(id);
      setLanguage(res.file.language);
      setCode(res.file.code);
      setSavedCode(res.file.code);
      setFileName(res.file.name);
      setOutput(null);
      setRunError(null);
    } catch (err) {
      showToast(err.message || 'Could not open that file.', 'error');
    }
  }

  function guardUnsaved(action) {
    if (hasUnsavedChanges) {
      setPendingAction(action);
    } else {
      action();
    }
  }

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setOutput(null); // never show stale output from a previous run/language
    try {
      const res = await runPracticeCode(language, code, input);
      setOutput(res.output);
      if (res.error) setRunError(res.error);
    } catch (err) {
      showToast(err.message || 'Could not run your code.', 'error');
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    const name = (fileName || 'untitled').trim();
    if (!name) return showToast('Enter a file name.', 'error');
    try {
      await savePracticeFile(name, language, code);
      setSavedCode(code);
      setFileName(name);
      loadFiles();
      showToast('File saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save the file.', 'error');
    }
  }

  function handleDownload() {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'untitled'}${meta?.ext || ''}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showToast('That file is too large to import.', 'error');
    const reader = new FileReader();
    reader.onload = () => {
      guardUnsaved(() => {
        setCode(String(reader.result || ''));
        setSavedCode(String(reader.result || ''));
        setFileName(file.name.replace(/\.[^.]+$/, ''));
        setOutput(null);
        setRunError(null);
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleDelete(id) {
    try {
      await deletePracticeFile(id);
      loadFiles();
    } catch (err) {
      showToast(err.message || 'Could not delete that file.', 'error');
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Practice</h1>
        <span className="text-xs text-ink-light">{fileName}{meta?.ext} {hasUnsavedChanges && '· unsaved changes'}</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
        {/* LEFT 20% — language selection + saved files */}
        <div className="flex flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-paper-card p-3 lg:w-1/5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-light">Language</p>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {COURSE_LANGUAGES.map((l) => (
              <button
                key={l.value}
                onClick={() => guardUnsaved(() => doSwitchLanguage(l.value))}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${language === l.value ? 'border-teal bg-teal/10 text-ink' : 'border-line text-ink-light hover:bg-paper'}`}
              >
                <span>{l.icon}</span> {l.label}
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-light">Saved Files</p>
          {files.length === 0 ? (
            <p className="text-xs text-ink-light">No saved files yet.</p>
          ) : (
            <div className="space-y-1">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-paper">
                  <button onClick={() => guardUnsaved(() => doOpenFile(f.id))} className="truncate text-left text-ink">{f.name}</button>
                  <button onClick={() => handleDelete(f.id)} className="shrink-0 text-ink-light hover:text-crimson">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MIDDLE 40% — editor */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-paper-card lg:w-2/5">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-28 rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink" />
            <button onClick={handleRun} disabled={running} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{running ? 'Running…' : 'Run'}</button>
            <button onClick={() => guardUnsaved(doNewFile)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper">New File</button>
            <button onClick={handleSave} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper">Save File</button>
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper">
              Import File
              <input type="file" accept=".py,.c,.cpp,.java,.js,.txt" onChange={handleImport} className="hidden" />
            </label>
            <button onClick={handleDownload} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper">Download</button>
            <button onClick={() => setCode('')} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper">Clear</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor value={code} onChange={setCode} language={language} />
          </div>
          <input
            value={input} onChange={(e) => setInput(e.target.value)} placeholder="Program input (optional)"
            className="border-t border-line bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        {/* RIGHT 40% — output */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-paper-card lg:w-2/5">
          <p className="border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-light">Output</p>
          <pre className={`flex-1 overflow-auto p-3 font-mono text-xs ${runError ? 'text-crimson' : 'text-ink'}`}>
            {running ? 'Running…' : (runError || output || '(no output yet — click Run)')}
          </pre>
        </div>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-paper-card p-5 text-center max-h-[85vh] overflow-y-auto">
            <p className="text-sm font-semibold text-ink">You have unsaved changes. Continue?</p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={async () => { await handleSave(); const a = pendingAction; setPendingAction(null); a(); }} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Save & Continue</button>
              <button onClick={() => { const a = pendingAction; setPendingAction(null); a(); }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink">Discard</button>
              <button onClick={() => setPendingAction(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
