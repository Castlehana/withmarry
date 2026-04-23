import { useEffect, useRef, useState, type MutableRefObject } from "react";

const SCRIPT_FILE = "our-story-script.txt";
const TEXT_FADE_IN_MS = 450;
const TEXT_FADE_OUT_MS = 550;
/** 한 대본이 사라진 뒤 다음 대본까지 간격 */
const BETWEEN_SCRIPT_LINES_MS = 1500;
/** audio 비었거나 재생 실패 시 이 시간 후 다음 대본 */
const NO_AUDIO_DWELL_MS = 5000;

type ScriptLine = { text: string; audio: string };

function parseScriptJson(raw: string): ScriptLine[] {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  try {
    const data: unknown = JSON.parse(trimmed);
    const arr: unknown = Array.isArray(data) ? data : (data as { lines?: unknown }).lines;
    if (!Array.isArray(arr)) return [];
    const out: ScriptLine[] = [];
    for (const row of arr) {
      if (row == null || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text.trim() : "";
      if (!text) continue;
      const audio = typeof o.audio === "string" ? o.audio.trim() : "";
      out.push({ text, audio });
    }
    return out;
  } catch {
    return [];
  }
}

function wait(ms: number, signal: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (!signal.cancelled) resolve();
    }, ms);
  });
}

type InterludeScriptSequenceProps = {
  interludeOpen: boolean;
  scriptGateOpen: boolean;
  baseUrl: string;
  /** 웨이브 캔버스와 공유 — 재생 중 AnalyserNode 연결 */
  waveAnalyserRef?: MutableRefObject<AnalyserNode | null>;
  /** .wav가 실제로 재생·라우팅 중일 때만 true(웨이브 위상·RMS 연동) */
  wavActiveRef?: MutableRefObject<boolean>;
};

/**
 * main_page/our-story-script.txt(JSON) — [{ "text": "…", "audio": "파일.wav"|"" }]
 * wav는 Web Audio로 출력·`waveAnalyserRef` + `wavActiveRef`로 캔버스와 동기(재생 중만 웨이브 구동).
 */
export function InterludeScriptSequence({
  interludeOpen,
  scriptGateOpen,
  baseUrl,
  waveAnalyserRef,
  wavActiveRef,
}: InterludeScriptSequenceProps) {
  const [lines, setLines] = useState<ScriptLine[]>([]);
  const [displayText, setDisplayText] = useState("");
  const [textVisible, setTextVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runIdRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const assetBase = baseUrl.replace(/\/$/, "");

  const disconnectScriptWiring = () => {
    if (wavActiveRef) wavActiveRef.current = false;
    try {
      mediaElementSourceRef.current?.disconnect();
    } catch {
      /* noop */
    }
    mediaElementSourceRef.current = null;
    if (waveAnalyserRef) {
      try {
        waveAnalyserRef.current?.disconnect();
      } catch {
        /* noop */
      }
      waveAnalyserRef.current = null;
    }
  };

  const closeInterludeAudioContext = () => {
    disconnectScriptWiring();
    try {
      void audioContextRef.current?.close();
    } catch {
      /* noop */
    }
    audioContextRef.current = null;
  };

  const connectWavToAnalyser = (audio: HTMLAudioElement): void => {
    if (!waveAnalyserRef) return;
    disconnectScriptWiring();
    try {
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext();
        audioContextRef.current = ctx;
      }
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      mediaElementSourceRef.current = src;
      waveAnalyserRef.current = analyser;
      if (wavActiveRef) wavActiveRef.current = true;
      void ctx.resume();
    } catch {
      disconnectScriptWiring();
    }
  };

  useEffect(() => {
    if (!interludeOpen) {
      closeInterludeAudioContext();
      setLines([]);
      setDisplayText("");
      setTextVisible(false);
      return;
    }
    if (!scriptGateOpen) return;

    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${assetBase}/${SCRIPT_FILE}`, { signal: ac.signal });
        if (!res.ok) {
          if (!cancelled) setLines([]);
          return;
        }
        const raw = await res.text();
        if (cancelled) return;
        setLines(parseScriptJson(raw));
      } catch {
        if (!cancelled) setLines([]);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [interludeOpen, scriptGateOpen, assetBase]);

  useEffect(() => {
    if (!interludeOpen || !scriptGateOpen || lines.length === 0) return;

    const signal = { cancelled: false };
    const runId = ++runIdRef.current;
    const timeoutIds: number[] = [];

    const stopAudio = () => {
      const a = audioRef.current;
      if (a) a.pause();
      disconnectScriptWiring();
      if (a) {
        a.removeAttribute("src");
        a.load();
      }
      audioRef.current = null;
    };

    const playLineAudio = (fileName: string): Promise<void> => {
      return new Promise((resolve) => {
        if (signal.cancelled || runIdRef.current !== runId) {
          resolve();
          return;
        }

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          stopAudio();
          resolve();
        };

        if (!fileName) {
          disconnectScriptWiring();
          timeoutIds.push(window.setTimeout(finish, NO_AUDIO_DWELL_MS));
          return;
        }

        const src = `${assetBase}/${encodeURIComponent(fileName)}`;
        const audio = new Audio();
        audioRef.current = audio;
        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener(
          "error",
          () => {
            disconnectScriptWiring();
            timeoutIds.push(window.setTimeout(finish, NO_AUDIO_DWELL_MS));
          },
          { once: true }
        );
        audio.src = src;
        audio.load();
        connectWavToAnalyser(audio);
        void audio.play().catch(() => {
          disconnectScriptWiring();
          timeoutIds.push(window.setTimeout(finish, NO_AUDIO_DWELL_MS));
        });
      });
    };

    (async () => {
      for (let i = 0; i < lines.length; i++) {
        if (signal.cancelled || runIdRef.current !== runId) break;
        const line = lines[i];

        setDisplayText(line.text);
        setTextVisible(false);
        await wait(30, signal);
        if (signal.cancelled || runIdRef.current !== runId) break;

        setTextVisible(true);
        const audioPromise = playLineAudio(line.audio);

        await wait(TEXT_FADE_IN_MS, signal);
        if (signal.cancelled || runIdRef.current !== runId) break;

        await audioPromise;
        if (signal.cancelled || runIdRef.current !== runId) break;

        setTextVisible(false);
        await wait(TEXT_FADE_OUT_MS, signal);
        if (signal.cancelled || runIdRef.current !== runId) break;
        if (i < lines.length - 1) {
          await wait(BETWEEN_SCRIPT_LINES_MS, signal);
          if (signal.cancelled || runIdRef.current !== runId) break;
        }
      }

      timeoutIds.forEach((id) => window.clearTimeout(id));
      stopAudio();
      if (!signal.cancelled && runIdRef.current === runId) {
        setDisplayText("");
        setTextVisible(false);
      }
    })();

    return () => {
      signal.cancelled = true;
      runIdRef.current++;
      timeoutIds.forEach((id) => window.clearTimeout(id));
      stopAudio();
    };
  }, [interludeOpen, scriptGateOpen, lines, assetBase, waveAnalyserRef, wavActiveRef]);

  if (!interludeOpen || !scriptGateOpen) return null;
  if (lines.length === 0 && !displayText) return null;

  return (
    <div className="hourglass-interlude-script" aria-live="polite">
      {displayText ? (
        <p
          className={`hourglass-interlude-script__text${
            textVisible ? " hourglass-interlude-script__text--visible" : ""
          }`}
        >
          {displayText}
        </p>
      ) : null}
    </div>
  );
}
