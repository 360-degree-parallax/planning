// node tools/check_db.mjs — 사례 DB 형식 검사
import { readFileSync } from 'node:fs';

const d = JSON.parse(readFileSync(new URL('../db/cases.json', import.meta.url)));
const V = Object.keys(d.verdicts), P = Object.keys(d.perspectives);
const errs = [];
const ids = new Set();
for (const c of d.cases) {
  const at = `[${c.id}]`;
  if (ids.has(c.id)) errs.push(`${at} id 중복`); ids.add(c.id);
  if (!['real', 'practice'].includes(c.kind)) errs.push(`${at} kind`);
  for (const k of ['situation', 'symptom', 'problem']) if (!c.what?.[k]) errs.push(`${at} what.${k} 비어 있음`);
  if (c.verified !== c.refs.length > 0) errs.push(`${at} verified와 refs 불일치`);
  if (c.refs.some(u => !/^https:\/\//.test(u))) errs.push(`${at} refs는 https 주소`);
  if (c.hyps.length < 3) errs.push(`${at} 가설 3개 이상`);
  const pass = c.hyps.filter(h => d.verdicts[h.verdict]?.pass).length;
  if (!pass) errs.push(`${at} 생존 가설이 없음`);
  if (pass === c.hyps.length) errs.push(`${at} 탈락 가설이 없음`);
  c.hyps.forEach((h, i) => {
    if (!V.includes(h.verdict)) errs.push(`${at} 가설 ${i + 1} verdict=${h.verdict}`);
    if (!P.includes(h.perspective)) errs.push(`${at} 가설 ${i + 1} perspective=${h.perspective}`);
    for (const k of ['text', 'why_not_yet', 'reason']) if (!h[k]) errs.push(`${at} 가설 ${i + 1} ${k} 비어 있음`);
  });
  if (!c.solution || !c.lesson) errs.push(`${at} solution·lesson 비어 있음`);
}
const count = (f) => d.cases.flatMap(c => c.hyps).reduce((m, h) => (m[f(h)] = (m[f(h)] || 0) + 1, m), {});
console.log(`사례 ${d.cases.length}개 (실제 ${d.cases.filter(c => c.kind === 'real').length}, 연습 ${d.cases.filter(c => c.kind === 'practice').length}, 출처 확인 ${d.cases.filter(c => c.verified).length})`);
console.log('판정별 가설 수', count(h => d.verdicts[h.verdict]?.label));
console.log('관점별 가설 수', count(h => d.perspectives[h.perspective]));
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log('형식 검사 통과');
