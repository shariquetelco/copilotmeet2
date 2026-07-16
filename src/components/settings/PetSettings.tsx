import { usePetStore, PetSize, PetPosition } from "@/store/petStore";

const personas = ["nova", "buddy", "luna", "echo", "atlas"];
const sizes: PetSize[] = ["small", "medium", "large"];
const positions: PetPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <span className="text-[17px] font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-6 mb-6">
      <h2 className="text-[22px] font-bold text-foreground mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  );
}

export default function PetSettings() {
  const {
    persona,
    size,
    position,
    opacityIdle,
    alwaysOnTop,
    setPersona,
    setSize,
    setPosition,
    setOpacityIdle,
    setAlwaysOnTop,
  } = usePetStore();

  return (
    <div className="max-w-2xl">
      <SectionCard title="Appearance">
        <SettingRow label="Companion">
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] capitalize bg-white"
          >
            {personas.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Size">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as PetSize)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] capitalize bg-white"
          >
            {sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Position">
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as PetPosition)}
            className="border border-input rounded-lg px-3 py-2 text-[16px] capitalize bg-white"
          >
            {positions.map((p) => (
              <option key={p} value={p}>{p.replace("-", " ")}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Idle Opacity">
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.1}
            value={opacityIdle}
            onChange={(e) => setOpacityIdle(parseFloat(e.target.value))}
            className="w-40"
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Behavior">
        <SettingRow label="Always on Top">
          <input
            type="checkbox"
            checked={alwaysOnTop}
            onChange={(e) => setAlwaysOnTop(e.target.checked)}
            className="w-5 h-5"
          />
        </SettingRow>
      </SectionCard>
    </div>
  );
}