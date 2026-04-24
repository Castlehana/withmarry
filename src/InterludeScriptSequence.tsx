import { Fragment, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { OurStoryScriptLine } from "./ourStoryPages";
import type { WeddingData } from "./wedding-data.types";
import { weddingData } from "./wedding-data";

const TEXT_FADE_IN_MS = 450;
const TEXT_FADE_OUT_MS = 450;
/** 한 대본이 사라진 뒤 다음 대본까지 간격 (페이드아웃 + 본 값 + 다음 줄 진입 30ms ≈ 1s) */
const BETWEEN_SCRIPT_LINES_MS = 520;
/** audio 비었거나 재생 실패 시 이 시간 후 다음 대본 */
const NO_AUDIO_DWELL_MS = 5000;
/** 대본 mp3 출력 게인(선형). 1=원본(너무 크면 클리핑) */
const SCRIPT_AUDIO_OUT_LINEAR_GAIN = 8;

/** JSON 대본 문자열의 `<br>` / `<br/>` / `<br />` → 실제 줄바꿈(대소문자 무관) */
function scriptTextWithBrNodes(text: string): ReactNode {
  const parts = text.split(/<br\s*\/?>/gi);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={`br-${i}`}>
      {i > 0 ? <br /> : null}
      {part}
    </Fragment>
  ));
}

/** 부모가 홈/챕터 전환 시 대본 오디오를 서서히 줄일 때 전달 */
export type ScriptAudioFadeRequest = { id: number; durationMs: number };

function normalizeSpeakerKey(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** `speaker`: `groom` / `bride` 등 — `wedding-data`의 이름(이름 필드)만 표시 */
function speakerToGivenName(speaker: string | undefined, couple: WeddingData["couple"]): string {
  const k = normalizeSpeakerKey(speaker);
  if (k === "groom" || k === "신랑") return couple.groom.이름.trim();
  if (k === "bride" || k === "신부") return couple.bride.이름.trim();
  return "";
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
  /** 현재 페이지 폴더 URL — `audio` 파일명과 조합 */
  baseUrl: string;
  /** `our-story-pages.txt` 에서 현재 페이지에 해당하는 대사 목록 */
  scriptLines: OurStoryScriptLine[];
  /** 웨이브 캔버스와 공유 — 재생 중 AnalyserNode 연결 */
  waveAnalyserRef?: MutableRefObject<AnalyserNode | null>;
  /** 대사 오디오가 실제로 재생·라우팅 중일 때만 true(웨이브 위상·RMS 연동) */
  wavActiveRef?: MutableRefObject<boolean>;
  /** 홈 toBlack / 커튼 등과 맞춰 출력 게인·볼륨 페이드아웃 */
  scriptAudioFadeRequest?: ScriptAudioFadeRequest | null;
  /** 대본 시퀀스 전체 종료 시 true, 재시작·인터루드 닫기 등으로 false */
  onScriptFinished?: (finished: boolean) => void;
};

/**
 * text 안의 `<br>`, `<br/>`, `<br />` 는 줄바꿈으로 표시.
 * `speaker` 는 `data-speaker` 로만 전달(CSS·스크린리더 확장용).
 * 대사 mp3는 Web Audio로 출력·`waveAnalyserRef` + `wavActiveRef`로 캔버스와 동기(재생 중만 웨이브 구동).
 */
export function InterludeScriptSequence({
  interludeOpen,
  scriptGateOpen,
  baseUrl,
  scriptLines,
  waveAnalyserRef,
  wavActiveRef,
  scriptAudioFadeRequest,
  onScriptFinished,
}: InterludeScriptSequenceProps) {
  const [lines, setLines] = useState<OurStoryScriptLine[]>([]);
  const [displayText, setDisplayText] = useState("");
  const [displaySpeaker, setDisplaySpeaker] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [textVisible, setTextVisible] = useState(false);
  const [nameVisible, setNameVisible] = useState(false);
  /** 마지막 줄까지 재생·페이드아웃 완료 */
  const [scriptFinished, setScriptFinished] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runIdRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const scriptGainRef = useRef<GainNode | null>(null);

  const assetBase = baseUrl.replace(/\/$/, "");

  const disconnectScriptWiring = () => {
    if (wavActiveRef) wavActiveRef.current = false;
    try {
      mediaElementSourceRef.current?.disconnect();
    } catch {
      /* noop */
    }
    mediaElementSourceRef.current = null;
    try {
      scriptGainRef.current?.disconnect();
    } catch {
      /* noop */
    }
    scriptGainRef.current = null;
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
      const gain = ctx.createGain();
      gain.gain.value = SCRIPT_AUDIO_OUT_LINEAR_GAIN;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      mediaElementSourceRef.current = src;
      scriptGainRef.current = gain;
      waveAnalyserRef.current = analyser;
      if (wavActiveRef) wavActiveRef.current = true;
      void ctx.resume();
    } catch {
      disconnectScriptWiring();
    }
  };

  useEffect(() => {
    if (!scriptAudioFadeRequest || scriptAudioFadeRequest.durationMs <= 0) return;
    const durMs = scriptAudioFadeRequest.durationMs;
    const durSec = durMs / 1000;

    const ctx = audioContextRef.current;
    const gain = scriptGainRef.current;
    if (ctx && gain && ctx.state !== "closed") {
      let rafVol = 0;
      const stopVolRaf = () => {
        if (rafVol) cancelAnimationFrame(rafVol);
        rafVol = 0;
      };
      void ctx.resume().catch(() => {});
      try {
        const t0 = ctx.currentTime;
        const param = gain.gain;
        param.cancelScheduledValues(t0);
        const cur = Math.max(0, param.value);
        param.setValueAtTime(cur, t0);
        param.linearRampToValueAtTime(0, t0 + durSec);
      } catch {
        /* noop */
      }
      /* MediaElementSource 연결 시 element.volume은 출력에 반영되지 않음 — 게인 외에 엘리먼트 볼륨도 줄이면 이후 분기·해제 시 클릭 완화 */
      const el = audioRef.current;
      if (el) {
        const from = el.volume;
        const start = performance.now();
        const tickVol = (now: number) => {
          const u = Math.min(1, (now - start) / durMs);
          el.volume = Math.max(0, from * (1 - u));
          if (u < 1) rafVol = requestAnimationFrame(tickVol);
        };
        rafVol = requestAnimationFrame(tickVol);
      }
      return () => {
        stopVolRaf();
        try {
          const c = audioContextRef.current;
          const gn = scriptGainRef.current;
          if (c && gn && c.state !== "closed") {
            gn.gain.cancelScheduledValues(c.currentTime);
          }
        } catch {
          /* noop */
        }
      };
    }

    const el = audioRef.current;
    if (!el) return;
    const from = el.volume;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / durMs);
      el.volume = Math.max(0, from * (1 - u));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [scriptAudioFadeRequest?.id, scriptAudioFadeRequest?.durationMs]);

  useEffect(() => {
    onScriptFinished?.(scriptFinished);
  }, [scriptFinished, onScriptFinished]);

  useEffect(() => {
    if (!interludeOpen) {
      closeInterludeAudioContext();
      setLines([]);
      setDisplayText("");
      setDisplaySpeaker("");
      setDisplayName("");
      setTextVisible(false);
      setNameVisible(false);
      setScriptFinished(false);
      return;
    }
    const next = scriptLines.filter((l) => typeof l.text === "string" && l.text.trim().length > 0);
    setLines(next.map(({ text, audio, speaker }) => ({ text, audio, speaker })));
    if (!scriptGateOpen) {
      setScriptFinished(false);
      setDisplayName("");
      setNameVisible(false);
    }
  }, [interludeOpen, scriptGateOpen, scriptLines]);

  useEffect(() => {
    if (!interludeOpen || !scriptGateOpen || lines.length === 0) return;

    setScriptFinished(false);
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
      const couple = weddingData.couple;
      for (let i = 0; i < lines.length; i++) {
        if (signal.cancelled || runIdRef.current !== runId) break;
        const line = lines[i];
        const currKey = normalizeSpeakerKey(line.speaker);
        const nameForLine = speakerToGivenName(line.speaker, couple);
        const prevLine = i > 0 ? lines[i - 1] : undefined;
        const sameSpeakerAsPrev =
          i > 0 && currKey.length > 0 && currKey === normalizeSpeakerKey(prevLine?.speaker);
        const nextLine = i < lines.length - 1 ? lines[i + 1] : undefined;
        const nextKey = normalizeSpeakerKey(nextLine?.speaker);
        const nextIsSameSpeaker =
          i < lines.length - 1 && currKey.length > 0 && currKey === nextKey;

        setDisplayText(line.text);
        setDisplaySpeaker(line.speaker?.trim() ?? "");
        setDisplayName(nameForLine);
        setTextVisible(false);
        if (!sameSpeakerAsPrev) {
          setNameVisible(false);
        }
        await wait(30, signal);
        if (signal.cancelled || runIdRef.current !== runId) break;

        setTextVisible(true);
        if (nameForLine) {
          setNameVisible(true);
        } else {
          setNameVisible(false);
        }
        const audioPromise = playLineAudio(line.audio);

        await wait(TEXT_FADE_IN_MS, signal);
        if (signal.cancelled || runIdRef.current !== runId) break;

        await audioPromise;
        if (signal.cancelled || runIdRef.current !== runId) break;

        setTextVisible(false);
        if (!nextIsSameSpeaker) {
          setNameVisible(false);
        }
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
        setDisplaySpeaker("");
        setDisplayName("");
        setTextVisible(false);
        setNameVisible(false);
        setScriptFinished(true);
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
  if (lines.length === 0 && !displayText && !scriptFinished) return null;

  return (
    <div className="hourglass-interlude-script" aria-live="polite">
      {displayName ? (
        <p
          className={`hourglass-interlude-script__name${
            nameVisible ? " hourglass-interlude-script__name--visible" : ""
          }`}
          aria-hidden={!nameVisible}
        >
          {displayName}
        </p>
      ) : null}
      <div className="hourglass-interlude-script__body">
        {displayText ? (
          <p
            className={`hourglass-interlude-script__text${
              textVisible ? " hourglass-interlude-script__text--visible" : ""
            }`}
            data-speaker={displaySpeaker || undefined}
          >
            {scriptTextWithBrNodes(displayText)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
