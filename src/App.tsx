import { useEffect, useMemo, useState, type CSSProperties } from "react";

const FOCUS_SECONDS = 25 * 60;
const SHORT_BREAK_SECONDS = 5 * 60;
const LONG_BREAK_SECONDS = 15 * 60;
const LONG_BREAK_INTERVAL = 4;
const SESSIONS_PER_SWEATER = 10;
const STORAGE_KEY = "cozy-knits-state";

type Mode = "focus" | "shortBreak" | "longBreak";
type ColorOption = { name: string; value: string };
type SweaterDesign = {
  id: string;
  name: string;
  mainColor: ColorOption;
  accentColor: ColorOption;
  secondaryColor: ColorOption;
  pattern: string;
  style: string;
};
type SweaterProgress = {
  design: SweaterDesign;
  progress: number;
};
type CompletedSweater = SweaterProgress & {
  completedAt: string;
};
type StoredState = {
  currentSweater?: SweaterProgress;
  collection?: CompletedSweater[];
  stats?: {
    totalPomodoros: number;
    totalSweaters: number;
  };
  sessionInSweater?: number;
  focusSessionsCompleted?: number;
};

const MAIN_COLORS: ColorOption[] = [
  { name: "Burnt Orange", value: "#c5693d" },
  { name: "Forest Green", value: "#3d5f44" },
  { name: "Burgundy", value: "#6f2c3f" },
  { name: "Mustard", value: "#d8a546" },
  { name: "Navy", value: "#2c3f63" },
  { name: "Cream", value: "#f0e6d2" },
  { name: "Rust Red", value: "#b24b3b" },
  { name: "Sage", value: "#8aa78d" },
  { name: "Dusty Pink", value: "#d8a4b1" },
  { name: "Charcoal", value: "#4a4f55" },
  { name: "Cobalt", value: "#2f57c1" },
  { name: "Terracotta", value: "#c2755a" },
  { name: "Plum", value: "#6a416f" },
];

const ACCENT_COLORS: ColorOption[] = [
  { name: "Teal", value: "#3a7b7b" },
  { name: "Cream", value: "#f7efe3" },
  { name: "Brown", value: "#8a5a3c" },
  { name: "Maroon", value: "#7b2e3f" },
  { name: "Gold", value: "#d7b167" },
  { name: "White", value: "#fffdf8" },
  { name: "Coral", value: "#e58e7f" },
  { name: "Olive", value: "#7a8a58" },
  { name: "Sky", value: "#9ec7d8" },
  { name: "Peach", value: "#f1b89b" },
];

const PATTERNS = ["Solid", "Striped", "Gradient", "Color Block", "Speckled"];
const STYLES = ["Turtleneck", "Crewneck", "V-neck", "Oversized", "Cropped", "Cardigan"];

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const createSweaterName = (design: SweaterDesign) =>
  `${design.pattern} ${design.style} in ${design.mainColor.name}`;

const createSweaterId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sweater-${Math.random().toString(36).slice(2, 10)}`;
};

const createSweaterDesign = (): SweaterDesign => {
  const mainColor = pick(MAIN_COLORS);
  const accentColor = pick(ACCENT_COLORS);
  const secondaryColor = pick(MAIN_COLORS);
  const pattern = pick(PATTERNS);
  const style = pick(STYLES);
  const id = createSweaterId();
  const baseDesign = {
    id,
    name: "",
    mainColor,
    accentColor,
    secondaryColor,
    pattern,
    style,
  };
  return {
    ...baseDesign,
    name: createSweaterName(baseDesign),
  };
};

const readStoredState = (): StoredState => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as StoredState;
  } catch {
    return {};
  }
};

const SweaterSVG = ({
  sweater,
  progress,
  yarnProgress,
  isRunning,
  size = 320,
  showNeedles = true,
  showYarn = true,
}: {
  sweater: SweaterDesign;
  progress: number;
  yarnProgress: number;
  isRunning: boolean;
  size?: number;
  showNeedles?: boolean;
  showYarn?: boolean;
}) => {
  const rowCount = 26;
  const topY = 84;
  const bottomY = 230;
  const rowGap = (bottomY - topY) / rowCount;
  const progressRows = Math.max(0, Math.min(rowCount, (progress / 100) * rowCount));
  const activeRowIndex = Math.min(rowCount - 1, Math.floor(progressRows));
  const unclampedRowY = bottomY - activeRowIndex * rowGap;
  const activeRowY = Math.max(topY + 10, Math.min(bottomY - 6, unclampedRowY));
  const maskHeight = Math.max(0, Math.min(bottomY - topY, (progress / 100) * (bottomY - topY)));
  const maskY = bottomY - maskHeight;
  const idPrefix = sweater.id;
  const rowPaths = useMemo(
    () =>
      Array.from({ length: rowCount }).map((_, index) => {
        const y = bottomY - index * rowGap;
        const startX = 82;
        const endX = 238;
        const segmentWidth = 16;
        const amplitude = 4;
        const segments = Math.floor((endX - startX) / segmentWidth);
        let path = `M${startX} ${y}`;
        for (let i = 0; i < segments; i += 1) {
          const midX = startX + i * segmentWidth + segmentWidth / 2;
          const nextX = startX + (i + 1) * segmentWidth;
          const lift = i % 2 === 0 ? amplitude : -amplitude;
          path += ` Q${midX} ${y + lift} ${nextX} ${y}`;
        }
        return path;
      }),
    [rowCount, rowGap, bottomY]
  );
  const yarnScale = Math.max(0.1, 1 - (yarnProgress / 100) * 0.85);
  const yarnOrigin = { x: 72, y: 246 };
  const activeRowPath = rowPaths[activeRowIndex];
  const showActiveRow = progress < 100;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 320"
      className="sweater-svg"
      style={
        {
          "--row-color": sweater.accentColor.value,
          "--outline-color": "rgba(80, 60, 45, 0.8)",
          "--yarn-color": sweater.accentColor.value,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`${idPrefix}-shape`}>
          <path d="M95 90 Q160 40 225 90 L250 200 Q250 245 210 255 Q160 270 110 255 Q70 245 70 200 Z" />
          <path d="M95 100 Q60 120 48 155 Q36 190 62 214 Q80 230 100 212 Z" />
          <path d="M225 100 Q260 120 272 155 Q284 190 258 214 Q240 230 220 212 Z" />
        </clipPath>
        <mask id={`${idPrefix}-progress-mask`}>
          <rect x="0" y="0" width="320" height="320" fill="black" />
          <rect x="0" y={maskY} width="320" height={maskHeight} fill="white" />
        </mask>
        {sweater.pattern === "Striped" && (
          <linearGradient id={`${idPrefix}-body-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sweater.mainColor.value} />
            <stop offset="30%" stopColor={sweater.mainColor.value} />
            <stop offset="30%" stopColor={sweater.secondaryColor.value} />
            <stop offset="60%" stopColor={sweater.secondaryColor.value} />
            <stop offset="60%" stopColor={sweater.mainColor.value} />
            <stop offset="100%" stopColor={sweater.mainColor.value} />
          </linearGradient>
        )}
        {sweater.pattern === "Gradient" && (
          <linearGradient id={`${idPrefix}-body-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sweater.secondaryColor.value} />
            <stop offset="100%" stopColor={sweater.mainColor.value} />
          </linearGradient>
        )}
        {sweater.pattern === "Color Block" && (
          <linearGradient id={`${idPrefix}-body-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sweater.mainColor.value} />
            <stop offset="50%" stopColor={sweater.mainColor.value} />
            <stop offset="50%" stopColor={sweater.secondaryColor.value} />
            <stop offset="100%" stopColor={sweater.secondaryColor.value} />
          </linearGradient>
        )}
        {sweater.pattern === "Speckled" && (
          <pattern
            id={`${idPrefix}-body-fill`}
            x="0"
            y="0"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <rect width="18" height="18" fill={sweater.mainColor.value} />
            <circle cx="5" cy="6" r="1.2" fill={sweater.accentColor.value} opacity="0.6" />
            <circle cx="12" cy="10" r="1.1" fill={sweater.accentColor.value} opacity="0.4" />
          </pattern>
        )}
      </defs>

      <g clipPath={`url(#${idPrefix}-shape)`}>
        <path
          d="M95 90 Q160 40 225 90 L250 200 Q250 245 210 255 Q160 270 110 255 Q70 245 70 200 Z"
          fill={
            sweater.pattern === "Solid"
              ? sweater.mainColor.value
              : `url(#${idPrefix}-body-fill)`
          }
        />
        <path
          d="M95 100 Q60 120 48 155 Q36 190 62 214 Q80 230 100 212 Z"
          fill={
            sweater.pattern === "Solid"
              ? sweater.mainColor.value
              : `url(#${idPrefix}-body-fill)`
          }
        />
        <path
          d="M225 100 Q260 120 272 155 Q284 190 258 214 Q240 230 220 212 Z"
          fill={
            sweater.pattern === "Solid"
              ? sweater.mainColor.value
              : `url(#${idPrefix}-body-fill)`
          }
        />

        <g mask={`url(#${idPrefix}-progress-mask)`} className="sweater-rows">
          {rowPaths.map((path, index) => (
            <path key={`row-${index}`} d={path} />
          ))}
          {showActiveRow && (
            <path
              className={`active-row ${isRunning ? "running" : ""}`}
              d={activeRowPath}
            />
          )}
        </g>
      </g>

      <path
        d="M100 228 Q160 240 220 228 L220 245 Q160 258 100 245 Z"
        fill={sweater.accentColor.value}
      />
      <path
        d="M82 206 Q92 214 104 212 L104 228 Q88 234 74 220 Z"
        fill={sweater.accentColor.value}
      />
      <path
        d="M238 206 Q228 214 216 212 L216 228 Q232 234 246 220 Z"
        fill={sweater.accentColor.value}
      />
      {sweater.style === "Turtleneck" && (
        <path
          d="M125 68 Q160 48 195 68 L195 92 Q160 104 125 92 Z"
          fill={sweater.accentColor.value}
        />
      )}
      {sweater.style === "Crewneck" && (
        <path
          d="M132 82 Q160 66 188 82 L188 96 Q160 106 132 96 Z"
          fill={sweater.accentColor.value}
        />
      )}
      {sweater.style === "V-neck" && (
        <path
          d="M140 78 Q160 96 180 78 L180 94 Q160 110 140 94 Z"
          fill={sweater.accentColor.value}
        />
      )}

      <g className="sweater-outline">
        <path d="M95 90 Q160 40 225 90 L250 200 Q250 245 210 255 Q160 270 110 255 Q70 245 70 200 Z" />
        <path d="M95 100 Q60 120 48 155 Q36 190 62 214 Q80 230 100 212 Z" />
        <path d="M225 100 Q260 120 272 155 Q284 190 258 214 Q240 230 220 212 Z" />
      </g>

      {showNeedles && (
        <g transform={`translate(176 ${activeRowY - 4})`}>
          <g className={`needles-animate ${isRunning ? "active" : ""}`}>
            <rect x="-52" y="-4" width="104" height="4" rx="2" />
            <rect x="-50" y="-6" width="104" height="4" rx="2" transform="rotate(12)" />
            <circle cx="-52" cy="-2" r="4" />
            <circle cx="52" cy="-2" r="4" />
          </g>
        </g>
      )}

      {showYarn && (
        <g transform={`translate(${yarnOrigin.x} ${yarnOrigin.y})`}>
          <g className="yarn-ball">
            <g transform={`scale(${yarnScale})`}>
              <g className={`yarn-spin ${isRunning ? "active" : ""}`}>
                <circle cx="0" cy="0" r="38" />
                <path d="M-26 -8 Q0 -22 26 -6" />
                <path d="M-28 4 Q0 18 26 6" />
                <path d="M-20 -18 Q0 -28 20 -16" />
                <path d="M-22 16 Q0 26 22 18" />
              </g>
            </g>
          </g>
        </g>
      )}

      {showYarn && (
        <path
          className="yarn-strand"
          d={`M${yarnOrigin.x + 38 * yarnScale} ${yarnOrigin.y} C110 230 128 ${
            activeRowY + 10
          } 150 ${activeRowY - 6} S190 ${activeRowY - 8} 210 ${activeRowY - 6}`}
        />
      )}
    </svg>
  );
};

export default function App() {
  const [stored] = useState(readStoredState);
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionInSweater, setSessionInSweater] = useState(stored.sessionInSweater ?? 0);
  const [focusSessionsCompleted, setFocusSessionsCompleted] = useState(
    stored.focusSessionsCompleted ?? 0
  );
  const [currentSweater, setCurrentSweater] = useState<SweaterProgress>(
    stored.currentSweater ?? {
      design: createSweaterDesign(),
      progress: 0,
    }
  );
  const [collection, setCollection] = useState<CompletedSweater[]>(
    stored.collection ?? []
  );
  const [stats, setStats] = useState(
    stored.stats ?? {
      totalPomodoros: 0,
      totalSweaters: 0,
    }
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentSweater,
        collection,
        stats,
        sessionInSweater,
        focusSessionsCompleted,
      } satisfies StoredState)
    );
  }, [currentSweater, collection, stats, sessionInSweater, focusSessionsCompleted]);

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          if (mode === "focus") {
            setFocusSessionsCompleted((count) => count + 1);
            setStats((current) => ({
              ...current,
              totalPomodoros: current.totalPomodoros + 1,
            }));
            setSessionInSweater((current) => {
              const next = current + 1;
              if (next >= SESSIONS_PER_SWEATER) {
                setCollection((items) => [
                  {
                    design: currentSweater.design,
                    progress: 100,
                    completedAt: new Date().toISOString(),
                  },
                  ...items,
                ]);
                setStats((currentStats) => ({
                  ...currentStats,
                  totalSweaters: currentStats.totalSweaters + 1,
                }));
                setCurrentSweater({
                  design: createSweaterDesign(),
                  progress: 0,
                });
                return 0;
              }
              setCurrentSweater((sweater) => ({
                ...sweater,
                progress: Math.min(100, sweater.progress + 10),
              }));
              return next;
            });

            const isLongBreak = (focusSessionsCompleted + 1) % LONG_BREAK_INTERVAL === 0;
            const nextMode: Mode = isLongBreak ? "longBreak" : "shortBreak";
            setMode(nextMode);
            return nextMode === "longBreak" ? LONG_BREAK_SECONDS : SHORT_BREAK_SECONDS;
          }

          setMode("focus");
          return FOCUS_SECONDS;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRunning, mode, focusSessionsCompleted, currentSweater.design]);

  const totalSeconds =
    mode === "focus"
      ? FOCUS_SECONDS
      : mode === "longBreak"
        ? LONG_BREAK_SECONDS
        : SHORT_BREAK_SECONDS;
  const focusProgress = mode === "focus" ? 1 - secondsLeft / totalSeconds : 0;
  const baseProgress = currentSweater.progress;
  const sweaterProgress = Math.min(
    100,
    baseProgress + Math.max(0, focusProgress) * 10
  );
  const yarnProgress = baseProgress + (mode === "focus" ? focusProgress * 10 : 0);
  const displaySession = Math.min(
    SESSIONS_PER_SWEATER,
    sessionInSweater + (mode === "focus" ? 1 : 0)
  );
  const sessionDots = useMemo(
    () => Array.from({ length: SESSIONS_PER_SWEATER }),
    []
  );

  const handleToggle = () => {
    setIsRunning((value) => !value);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMode("focus");
    setSecondsLeft(FOCUS_SECONDS);
  };

  return (
    <div className="page">
      <div className="app-shell">
        <header className="header">
          <div>
            <p className="eyebrow">Cozy Knits</p>
            <h1>Stitch by stitch, one pomodoro at a time.</h1>
          </div>
        </header>

        <main className="content">
          <section className="controls">
            <div className="timer-card">
              <div className="timer-heading">
                <p className="timer-label">Current session</p>
                <span className={`mode-pill ${mode}`}>
                  {mode === "focus" ? "Focus" : mode === "longBreak" ? "Long break" : "Break"}
                </span>
              </div>
              <div className="timer-display">{formatTime(secondsLeft)}</div>
              <p className="timer-subtitle">
                Session {displaySession} of {SESSIONS_PER_SWEATER}
              </p>
              <div className="session-dots">
                {sessionDots.map((_, index) => (
                  <span
                    key={`dot-${index}`}
                    className={`dot ${index < sessionInSweater ? "filled" : ""}`}
                  />
                ))}
              </div>
              <div className="progress-row">
                <div className="progress-track">
                  <span className="progress-fill" style={{ width: `${sweaterProgress}%` }} />
                </div>
                <span className="progress-label">{Math.round(sweaterProgress)}%</span>
              </div>
            </div>

            <div className="control-row">
              <button className="primary" onClick={handleToggle}>
                {isRunning ? "Pause" : "Start"}
              </button>
              <button className="ghost" onClick={handleReset}>
                Reset
              </button>
            </div>

            <div className="stats">
              <p>
                <strong>{stats.totalPomodoros}</strong> total pomodoros completed
              </p>
              <p>
                <strong>{stats.totalSweaters}</strong> sweaters in your closet
              </p>
              <p className="muted">
                Your yarn ball shrinks as the sweater grows.
              </p>
            </div>
          </section>

          <section className="sweater-stage">
            <div className="sweater-header">
              <h2>{currentSweater.design.name}</h2>
              <p className="muted">
                {currentSweater.design.pattern} · {currentSweater.design.style}
              </p>
            </div>
            <SweaterSVG
              sweater={currentSweater.design}
              progress={sweaterProgress}
              yarnProgress={yarnProgress}
              isRunning={isRunning && mode === "focus"}
            />
            <div className="knit-status">
              <span>{Math.round(sweaterProgress)}% complete</span>
              <span>{isRunning && mode === "focus" ? "Knitting..." : "Needles resting"}</span>
            </div>
          </section>
        </main>

        <section className="collection">
          <div className="collection-header">
            <h2>Your Closet</h2>
            <p className="muted">{collection.length} sweaters completed</p>
          </div>
          {collection.length === 0 ? (
            <div className="empty-state">
              <p>Finish your first sweater to start your cozy closet.</p>
            </div>
          ) : (
            <div className="collection-grid">
              {collection.map((item) => (
                <div className="sweater-card" key={item.design.id}>
                  <SweaterSVG
                    sweater={item.design}
                    progress={100}
                    yarnProgress={100}
                    isRunning={false}
                    size={180}
                    showNeedles={false}
                    showYarn={false}
                  />
                  <div className="card-details">
                    <h3>{item.design.name}</h3>
                    <p className="muted">
                      Completed {new Date(item.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
