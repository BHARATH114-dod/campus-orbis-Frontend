// Run: node --test Frontend/src/utils/questionText.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestionText, isMultiLineQuestion, isCodeLine } from './questionText.js';

const kinds = (t) => parseQuestionText(t).map((b) => b.type);
const nonBlank = (s) => s.split('\n').filter((l) => l.trim());
const roundTrip = (t) => nonBlank(parseQuestionText(t).map((b) => b.content).join('\n'));

test('normal single-line question is untouched (one text block, same string)', () => {
  const q = 'What is the capital of France?';
  assert.equal(isMultiLineQuestion(q), false);
  assert.deepEqual(parseQuestionText(q), [{ type: 'text', content: q, lang: '' }]);
});

test('single-line code-looking text stays plain text (exactly as before)', () => {
  assert.deepEqual(kinds('for i in range(5): print(i)'), ['text']);
});

test('python code keeps indentation and is a code block', () => {
  const q = 'for i in range(5):\n    print(i)';
  const b = parseQuestionText(q);
  assert.deepEqual(b.map((x) => x.type), ['code']);
  assert.equal(b[0].content, q);
});

test('prose + python: prose stays text, code becomes code', () => {
  const q = 'What is the output of the following code?\n\nfor i in range(5):\n    print(i)\n\nChoose one.';
  const b = parseQuestionText(q);
  assert.deepEqual(b.map((x) => x.type), ['text', 'code', 'text']);
  assert.equal(b[1].content, 'for i in range(5):\n    print(i)');
});

test('C program', () => {
  const q = 'Predict the output:\n#include <stdio.h>\nint main() {\n    int x = 5;\n    printf("%d", x++);\n    return 0;\n}';
  const b = parseQuestionText(q);
  assert.deepEqual(b.map((x) => x.type), ['text', 'code']);
  assert.equal(b[1].content, q.split('\n').slice(1).join('\n'));
});

test('Java with a blank line inside the class stays one code block', () => {
  const q = 'What does this print?\npublic class Main {\n    static int f(int n) {\n        return n * 2;\n    }\n\n    public static void main(String[] a) {\n        System.out.println(f(4));\n    }\n}';
  const b = parseQuestionText(q);
  assert.deepEqual(b.map((x) => x.type), ['text', 'code']);
  assert.ok(b[1].content.includes('    }\n\n    public static void main'));
});

test('JavaScript', () => {
  const q = 'Output?\nconst arr = [1, 2, 3];\narr.forEach((n) => {\n  console.log(n * 2);\n});';
  assert.deepEqual(kinds(q), ['text', 'code']);
  assert.equal(parseQuestionText(q)[1].content, q.split('\n').slice(1).join('\n'));
});

test('fenced block is honoured verbatim, with language label', () => {
  const q = 'Fix the bug:\n```python\ndef f(x):\n\treturn x  +  1\n```\nWhich line?';
  const b = parseQuestionText(q);
  assert.deepEqual(b.map((x) => x.type), ['text', 'code', 'text']);
  assert.equal(b[1].lang, 'python');
  assert.equal(b[1].content, 'def f(x):\n\treturn x  +  1');
});

test('unclosed fence renders the rest as code', () => {
  assert.deepEqual(kinds('Q\n```c\nint x;\n  x++;'), ['text', 'code']);
});

test('multi-line prose is NOT turned into code and keeps its breaks', () => {
  const q = 'Read the passage carefully.\nThe cat sat on the mat.\n\nWhich statement is true?';
  const b = parseQuestionText(q);
  assert.deepEqual(b.map((x) => x.type), ['text']);
  assert.equal(b[0].content, q);
});

test('numbered/bulleted prose lists are not code', () => {
  assert.equal(isCodeLine('  1. First point'), false);
  assert.equal(isCodeLine('  - a bullet'), false);
});

test('CRLF from Windows paste is normalised', () => {
  const b = parseQuestionText('a\r\nfor i in x:\r\n    pass');
  assert.ok(!b.some((x) => x.content.includes('\r')));
});

test('long multi-line question: nothing lost, order and whitespace preserved', () => {
  const lines = [];
  for (let i = 0; i < 60; i++) lines.push(i % 3 === 0 ? `Step ${i}: explain carefully.` : `    value_${i} = compute(${i})  # trailing`);
  const q = lines.join('\n');
  assert.deepEqual(roundTrip(q), nonBlank(q));
});

test('round trip preserves exact whitespace of every non-blank line', () => {
  const q = 'Q?\n\tif (x) {\n\t\ty();\n  \t}\n   z = 1';
  assert.deepEqual(roundTrip(q), nonBlank(q));
});

test('empty / nullish input is safe', () => {
  assert.deepEqual(parseQuestionText(''), [{ type: 'text', content: '', lang: '' }]);
  assert.deepEqual(parseQuestionText(null), [{ type: 'text', content: '', lang: '' }]);
});
