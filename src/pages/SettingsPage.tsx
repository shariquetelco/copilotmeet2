import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import GeneralSettings from "@/components/settings/GeneralSettings";
import PetSettings from "@/components/settings/PetSettings";
import AISettings from "@/components/settings/AISettings";
import ProjectsPage from "@/pages/ProjectsPage";
import PrivacySettings from "@/components/settings/PrivacySettings";
import {
  Settings as SettingsIcon,
  Bot,
  Brain,
  FolderKanban,
  Keyboard,
  Lock,
  RefreshCw,
  Package,
  Download,
  LifeBuoy,
  MessageSquare,
  Bug,
  Star,
  Gift,
  Info,
} from "lucide-react";

const primaryNav = [{ label: "Projects", icon: FolderKanban }] as const;

const sections = [
  { label: "General", icon: SettingsIcon },
  { label: "Pet", icon: Bot },
  { label: "AI", icon: Brain },
  { label: "Hotkeys", icon: Keyboard },
  { label: "Privacy", icon: Lock },
  { label: "Updates", icon: RefreshCw },
] as const;

type Section = (typeof primaryNav)[number]["label"] | (typeof sections)[number]["label"];

const actions = [
  { label: "Export Workspace", icon: Package },
  { label: "Import Workspace", icon: Download },
  { label: "Get Help", icon: LifeBuoy },
  { label: "Send Feedback", icon: MessageSquare },
  { label: "Report Bug", icon: Bug },
  { label: "Rate CopilotMeet", icon: Star },
  { label: "Refer a Friend", icon: Gift },
  { label: "About", icon: Info },
];

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("Projects");
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, []);

  const renderNavButton = (item: { label: string; icon: any }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.label}
        onClick={() => setActive(item.label as Section)}
        className={`text-left px-4 py-3 rounded-xl text-[18px] font-semibold flex items-center gap-3 transition-colors duration-200 ${
          active === item.label
            ? "bg-primary text-white"
            : "text-gray-300 hover:bg-sidebar-accent hover:text-white"
        }`}
      >
        <Icon size={20} strokeWidth={2} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <aside className="w-[300px] h-full bg-sidebar text-sidebar-foreground p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 mb-8 mt-2">
            <div className="relative w-20 h-20 rounded-full bg-slate-700 border-2 border-primary flex items-center justify-center text-3xl shrink-0">
              🤖
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-success border-2 border-sidebar" />
            </div>
            <div>
              <div className="font-bold text-lg text-white">Nova</div>
              <div className="text-sm text-gray-400">Ready</div>
            </div>
          </div>

          <div className="flex flex-col gap-1 mb-6">
            {primaryNav.map(renderNavButton)}
          </div>

          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide px-4 mb-2">
            Settings
          </div>
          <div className="flex flex-col gap-1">
            {sections.map(renderNavButton)}
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-4 mt-4 border-t border-slate-600">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                className="text-left px-3 py-2 rounded-lg text-[16px] flex items-center gap-3 text-slate-300 hover:bg-sidebar-accent hover:text-white transition-colors"
              >
                <Icon size={16} strokeWidth={2} />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto">
        <h1 className="text-[42px] font-extrabold mb-8 text-foreground leading-tight">
          {active}
        </h1>
        {active === "Projects" && <ProjectsPage />}
        {active === "General" && <GeneralSettings />}
        {active === "Pet" && <PetSettings />}
        {active === "AI" && <AISettings />}
        {active === "Hotkeys" && <div>Hotkeys settings go here</div>}
        {active === "Privacy" && <PrivacySettings />}
        {active === "Updates" && <div>Updates settings go here</div>}
      </main>
    </div>
  );
}