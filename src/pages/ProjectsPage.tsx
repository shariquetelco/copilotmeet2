import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { Project } from "@/lib/projectService";
import { FolderPlus, Folder, Trash2, FileText } from "lucide-react";

const meetingModes = ["Interview", "Sales", "Procurement", "Legal", "Executive", "Custom"];

const projectColors = [
  { name: "blue", hex: "#3B82F6" },
  { name: "green", hex: "#22C55E" },
  { name: "purple", hex: "#A855F7" },
  { name: "orange", hex: "#F97316" },
  { name: "red", hex: "#EF4444" },
  { name: "yellow", hex: "#EAB308" },
  { name: "pink", hex: "#EC4899" },
  { name: "brown", hex: "#92400E" },
  { name: "slate", hex: "#475569" },
  { name: "cyan", hex: "#06B6D4" },
  { name: "lime", hex: "#84CC16" },
  { name: "gray", hex: "#6B7280" },
];

function colorHex(name: string) {
  return projectColors.find((c) => c.name === name)?.hex ?? "#3B82F6";
}

function ConfirmDeleteDialog({
  project,
  onConfirm,
  onCancel,
}: {
  project: Project;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-[20px] font-bold text-foreground mb-2">Delete Project?</h3>
        <p className="text-[15px] text-muted-foreground mb-6">
          This will permanently remove <span className="font-semibold">{project.name}</span> and
          all associated data. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[15px] font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-[15px] font-semibold bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const createProject = useProjectStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("Interview");
  const [color, setColor] = useState("blue");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await createProject(name.trim(), mode, color);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-[20px] font-bold text-foreground mb-4">New Project</h3>

        <label className="text-[14px] font-medium text-muted-foreground">Project Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Railway Interview"
          className="w-full border border-input rounded-lg px-3 py-2 text-[16px] mt-1 mb-4 bg-white"
          autoFocus
        />

        <label className="text-[14px] font-medium text-muted-foreground">Meeting Mode</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="w-full border border-input rounded-lg px-3 py-2 text-[16px] mt-1 mb-4 bg-white"
        >
          {meetingModes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <label className="text-[14px] font-medium text-muted-foreground">Project Color</label>
        <div className="grid grid-cols-6 gap-2 mt-2 mb-6">
          {projectColors.map((c) => (
            <button
              key={c.name}
              onClick={() => setColor(c.name)}
              className={`w-8 h-8 rounded-full transition-transform ${
                color === c.name ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
              }`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[15px] font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-[15px] font-semibold bg-primary text-white hover:opacity-90"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { setActiveProject, deleteProject } = useProjectStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const createdDate = new Date(project.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <div className="relative bg-card rounded-2xl shadow-sm p-4 pl-5 flex flex-col gap-2 overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:bg-secondary/40">
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: colorHex(project.color) }}
        />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Folder size={18} style={{ color: colorHex(project.color) }} />
            <h3 className="text-[16px] font-bold text-foreground">{project.name}</h3>
          </div>
          {project.is_active && (
            <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-green-100 text-success flex items-center gap-1">
              🟢 Active
            </span>
          )}
        </div>

        <span className="text-[13px] font-medium text-primary bg-secondary w-fit px-2 py-1 rounded-full">
          {project.meeting_mode}
        </span>

        <div className="flex items-center gap-1 text-[14px] text-muted-foreground">
          <FileText size={14} />
          0 Documents
        </div>

        <div className="text-[13px] text-muted-foreground">Created {createdDate}</div>

        <div className="flex gap-2 mt-2">
          {!project.is_active && (
            <button
              onClick={() => setActiveProject(project.id)}
              className="flex-1 px-3 py-2 rounded-lg text-[14px] font-semibold bg-primary text-white hover:opacity-90"
            >
              Set Active
            </button>
          )}
          <button
            onClick={() => setConfirmingDelete(true)}
            className="px-3 py-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDeleteDialog
          project={project}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            deleteProject(project.id);
            setConfirmingDelete(false);
          }}
        />
      )}
    </>
  );
}

export default function ProjectsPage() {
  const { projects, fetchProjects } = useProjectStore();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[16px] text-muted-foreground">
          Organize your documents by job, client, or meeting type.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-3 rounded-xl text-[15px] font-semibold bg-primary text-white hover:opacity-90 flex items-center gap-2"
        >
          <FolderPlus size={18} />
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm p-12 text-center">
          <FolderPlus size={40} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-[20px] font-bold text-foreground mb-1">No projects yet</h3>
          <p className="text-[15px] text-muted-foreground">
            Create your first project to start organizing documents for your meetings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {creating && <CreateProjectForm onClose={() => setCreating(false)} />}
    </div>
  );
}