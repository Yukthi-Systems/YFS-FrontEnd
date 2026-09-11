import { CheckCircle2, ChevronDown, ChevronUp, FileUp, Loader2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { useUploadQueue } from "../../hooks/useUploadQueue";

export function UploadTray() {
  const { tasks, dismissTask } = useUploadQueue();
  const [collapsed, setCollapsed] = useState(false);

  if (tasks.length === 0) return null;

  const isActive = (status: string) => status === "uploading" || status === "pending";
  const activeCount = tasks.filter((t) => isActive(t.status)).length;

  return (
    <div className="fixed bottom-5 left-5 z-[1900] w-full max-w-sm bg-bg-main border border-border-main rounded-2xl shadow-lg overflow-hidden animate-scale-in">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-main cursor-pointer"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="text-sm font-semibold text-text-heading flex items-center gap-2">
          <FileUp className="w-4 h-4 text-accent" />
          {activeCount > 0 ? `Uploading ${activeCount} item${activeCount > 1 ? "s" : ""}…` : "Uploads complete"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((v) => !v);
          }}
          className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition"
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="max-h-64 overflow-y-auto flex flex-col">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-main last:border-b-0">
              {isActive(task.status) && <Loader2 className="w-4 h-4 text-accent shrink-0 animate-spin" />}
              {task.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              {task.status === "error" && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-heading truncate">{task.fileName}</div>
                {task.status === "uploading" && (
                  <div className="w-full h-1 bg-border-main rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-150"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
                {task.status === "pending" && <div className="text-[11px] text-text-main mt-0.5">Preparing…</div>}
                {task.status === "error" && <div className="text-[11px] text-red-500 mt-0.5">{task.error}</div>}
              </div>

              {!isActive(task.status) && (
                <button
                  onClick={() => dismissTask(task.id)}
                  className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
