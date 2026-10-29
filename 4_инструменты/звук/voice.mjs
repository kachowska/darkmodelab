#!/usr/bin/env node
// Озвучка глав выпуска голосом ElevenLabs с таймингом каждого слова.
// Текст берётся из самих глав (массив SENT в <глава>/index.html), поэтому голос, анимация и .srt всегда совпадают.
// Настройки выпуска — <сборка>/voice.json (голос, модель, произношение).
//
// Запуск из корня проекта:
//   node --env-file=.env 4_инструменты/звук/voice.mjs 3_выпуски/<выпуск>/сборка [hook ch1 …] [--dry] [--force]
//   --dry    — только показать текст и число символов, без запроса к ElevenLabs (ничего не тратит)
//   --force  — переозвучить главу, даже если voice.mp3 уже есть
// Результат в папке главы: voice.mp3, voice_words.js (window.VOICE = {dur, words:[{w,t,e,si}]}), voice_align.json.
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry"), FORCE = args.includes("--force");
const pos = args.filter(a => !a.startsWith("--"));
const BUILD = path.resolve(pos[0] || ".");
const CFG = JSON.parse(fs.readFileSync(path.join(BUILD, "voice.json"), "utf8"));
const ALL = CFG.chapters;
const ONLY = pos.slice(1).length ? pos.slice(1) : ALL;

// текст диктора главы: [[предложение, ключевые слова], …]
function sentences(ch) {
  const html = fs.readFileSync(path.join(BUILD, ch, "index.html"), "utf8");
  const m = html.match(/const SENT = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error(`${ch}: не найден массив SENT`);
  return new Function("return " + m[1])();
}
// как слово произносится (Parkes → Паркс): только для голоса, на экране остаётся как в главе
const SAY = Object.entries(CFG.say || {});
const say = w => SAY.reduce((s, [a, b]) => s.split(a).join(b), w);

// разметка главы: слова (так же, как их режет DML.words) + произносимый текст + позиция каждого слова в нём
function plan(ch) {
  const S = sentences(ch), words = []; let text = "";
  S.forEach((s, si) => s[0].split(/\s+/).forEach(w => {
    if (text) text += " ";
    const sw = say(w);
    words.push({ w, si, at: text.length, len: sw.length });
    text += sw;
  }));
  return { S, words, text, first: say(S[0][0]), last: say(S[S.length - 1][0]) };
}

const P = Object.fromEntries(ALL.map(ch => [ch, plan(ch)]));
const total = ONLY.reduce((n, ch) => n + P[ch].text.length, 0);
console.log(`Голос ${CFG.voice_id} · модель ${CFG.model} · главы: ${ONLY.join(", ")} · ${total} символов`);
if (DRY) { ONLY.forEach(ch => console.log(`\n── ${ch} (${P[ch].text.length})\n${P[ch].text}`)); process.exit(0); }

if (!process.env.ELEVENLABS_API_KEY) process.loadEnvFile(path.join(ROOT, ".env"));   // ключ только из .env
const client = new ElevenLabsClient();

for (const ch of ONLY) {
  const dir = path.join(BUILD, ch), mp3 = path.join(dir, "voice.mp3");
  if (fs.existsSync(mp3) && !FORCE) { console.log(`${ch}: уже озвучена (--force, чтобы переозвучить)`); continue; }
  const p = P[ch], i = ALL.indexOf(ch);
  const { data, rawResponse } = await client.textToSpeech.convertWithTimestamps(CFG.voice_id, {
    text: p.text,
    modelId: CFG.model,
    languageCode: CFG.language,
    voiceSettings: { stability: CFG.settings.stability, similarityBoost: CFG.settings.similarity_boost },
    outputFormat: CFG.format || "mp3_44100_128",
    seed: CFG.seed ?? 42,
    previousText: i > 0 ? P[ALL[i - 1]].last : undefined,   // склейка глав без скачков интонации
    nextText: i < ALL.length - 1 ? P[ALL[i + 1]].first : undefined,
  }).withRawResponse();

  fs.writeFileSync(mp3, Buffer.from(data.audioBase64, "base64"));
  const A = data.alignment;
  fs.writeFileSync(path.join(dir, "voice_align.json"), JSON.stringify({ text: p.text, alignment: A }));
  if (A.characters.join("") !== p.text) console.warn(`${ch}: разметка голоса не совпала с текстом посимвольно — проверьте voice_words.js`);
  const st = A.characterStartTimesSeconds, en = A.characterEndTimesSeconds, last = st.length - 1;
  const words = p.words.map(x => ({
    w: x.w, si: x.si,
    t: +st[Math.min(x.at, last)].toFixed(3),
    e: +en[Math.min(x.at + x.len - 1, last)].toFixed(3),
  }));
  const dur = +en[last].toFixed(3);
  fs.writeFileSync(path.join(dir, "voice_words.js"), `window.VOICE = ${JSON.stringify({ dur, words })};\n`);
  console.log(`${ch}: ${dur} с, ${words.length} слов, символов списано: ${rawResponse.headers.get("x-character-count") ?? "?"}`);
}
