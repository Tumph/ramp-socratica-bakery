"use client";

import { useEffect, useState } from "react";

/**
 * Dev-only control for dialling in the drawer slide and the card flip by eye.
 *
 * Writes to the CSS custom properties the stylesheet already reads, so nothing
 * here is wired into the components themselves. Dropped from production
 * bundles via the NODE_ENV check, same as DevStateToggle.
 */

type Curve = [number, number, number, number];

const PRESETS: { name: string; curve: Curve }[] = [
  { name: "ease-out", curve: [0, 0, 0.2, 1] },
  { name: "soft", curve: [0.16, 1, 0.3, 1] },
  { name: "snappy", curve: [0.33, 1, 0.2, 1] },
  { name: "linear", curve: [0, 0, 1, 1] },
  { name: "in-out", curve: [0.45, 0.05, 0.55, 0.95] },
];

function Row({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rampTunerRow">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{value}</output>
    </label>
  );
}

export function AnimationTuner() {
  const [open, setOpen] = useState(false);
  const [drawerMs, setDrawerMs] = useState(420);
  const [drawer, setDrawer] = useState<Curve>([0.16, 1, 0.3, 1]);
  const [flipMs, setFlipMs] = useState(460);
  const [flip, setFlip] = useState<Curve>([0.45, 0.05, 0.55, 0.95]);

  const drawerEase = `cubic-bezier(${drawer.join(", ")})`;
  const flipEase = `cubic-bezier(${flip.join(", ")})`;

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--ramp-drawer-duration", `${drawerMs}ms`);
    root.setProperty("--ramp-drawer-ease", drawerEase);
    root.setProperty("--ramp-flip-duration", `${flipMs}ms`);
    root.setProperty("--ramp-flip-ease", flipEase);
  }, [drawerMs, drawerEase, flipMs, flipEase]);

  if (process.env.NODE_ENV !== "development") return null;

  function set(which: "drawer" | "flip", index: number, value: number) {
    const apply = (c: Curve): Curve => {
      const next = [...c] as Curve;
      next[index] = value;
      return next;
    };
    if (which === "drawer") setDrawer(apply);
    else setFlip(apply);
  }

  const css = `.rampDrawer { animation: rampDrawerIn ${drawerMs}ms ${drawerEase} both; }
.rampCardFlipInner { transition: transform ${flipMs}ms ${flipEase}; }`;

  return (
    <div className="rampTuner">
      <button type="button" className="rampTunerToggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Close tuner" : "Animation tuner"}
      </button>

      {open && (
        <div className="rampTunerBody">
          <p className="rampTunerHead">Drawer slide</p>
          <Row label="dur" value={drawerMs} min={100} max={1200} step={10} onChange={setDrawerMs} />
          {drawer.map((n, i) => (
            <Row
              key={`d${i}`}
              label={`p${i + 1}`}
              value={n}
              min={i % 2 === 0 ? 0 : -1}
              max={i % 2 === 0 ? 1 : 2}
              step={0.01}
              onChange={(v) => set("drawer", i, v)}
            />
          ))}
          <div className="rampTunerPresets">
            {PRESETS.map((preset) => (
              <button key={preset.name} type="button" onClick={() => setDrawer(preset.curve)}>
                {preset.name}
              </button>
            ))}
          </div>

          <p className="rampTunerHead">Card flip</p>
          <Row label="dur" value={flipMs} min={100} max={1600} step={10} onChange={setFlipMs} />
          {flip.map((n, i) => (
            <Row
              key={`f${i}`}
              label={`p${i + 1}`}
              value={n}
              min={i % 2 === 0 ? 0 : -1}
              max={i % 2 === 0 ? 1 : 2}
              step={0.01}
              onChange={(v) => set("flip", i, v)}
            />
          ))}
          <div className="rampTunerPresets">
            {PRESETS.map((preset) => (
              <button key={preset.name} type="button" onClick={() => setFlip(preset.curve)}>
                {preset.name}
              </button>
            ))}
          </div>

          <pre className="rampTunerCss">{css}</pre>
          <button
            type="button"
            className="rampTunerCopy"
            onClick={() => navigator.clipboard?.writeText(css).catch(() => {})}
          >
            Copy CSS
          </button>
        </div>
      )}
    </div>
  );
}
