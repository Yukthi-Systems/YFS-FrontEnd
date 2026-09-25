/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { CheckCircle2, ChevronDown, ChevronUp, FileUp, Loader2, Pause, Play, X, XCircle } from "lucide-react";
import { useState } from "react";
import { useUploadQueue } from "../../hooks/useUploadQueue";

export function UploadTray() {
  const { tasks, dismissTask, pauseTask, resumeTask, cancelTask } = useUploadQueue();
  const [collapsed, setCollapsed] = useState(false);

  if (tasks.length === 0) return null;

  const isActive = (status: string) => status === "uploading" || status === "pending" || status === "paused" || status === "reconnecting";
  const activeCount = tasks.filter((t) => isActive(t.status)).length;
  const allActivePaused = activeCount > 0 && tasks.filter((t) => isActive(t.status)).every((t) => t.status === "paused");

  return (
    <div className="w-full bg-bg-main border border-border-main rounded-2xl shadow-lg overflow-hidden animate-scale-in">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border-main cursor-pointer"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="text-sm font-semibold text-text-heading flex items-center gap-2">
          <FileUp className="w-4 h-4 text-accent" />
          {activeCount > 0
            ? `${allActivePaused ? "Paused" : "Uploading"} ${activeCount} item${activeCount > 1 ? "s" : ""}…`
            : "Uploads complete"}
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
              {task.status === "uploading" && <Loader2 className="w-4 h-4 text-accent shrink-0 animate-spin" />}
              {task.status === "pending" && <Loader2 className="w-4 h-4 text-accent shrink-0 animate-spin" />}
              {task.status === "reconnecting" && <Loader2 className="w-4 h-4 text-orange-500 shrink-0 animate-spin" />}
              {task.status === "paused" && <Pause className="w-4 h-4 text-text-main shrink-0" />}
              {task.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              {task.status === "error" && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-heading truncate">{task.fileName}</div>
                {(task.status === "uploading" || task.status === "paused" || task.status === "reconnecting") && (
                  <div className="w-full h-1 bg-border-main rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-150"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
                {task.status === "pending" && <div className="text-[11px] text-text-main mt-0.5">Preparing…</div>}
                {task.status === "reconnecting" && <div className="text-[11px] text-orange-500 mt-0.5">Reconnecting…</div>}
                {task.status === "error" && <div className="text-[11px] text-red-500 mt-0.5">{task.error}</div>}
              </div>

              {task.status === "uploading" && (
                <button
                  onClick={() => pauseTask(task.id)}
                  title="Pause"
                  className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition shrink-0"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              )}
              {task.status === "paused" && (
                <button
                  onClick={() => resumeTask(task.id)}
                  title="Resume"
                  className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
              {isActive(task.status) ? (
                <button
                  onClick={() => cancelTask(task.id)}
                  title="Cancel"
                  className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => dismissTask(task.id)}
                  title="Dismiss"
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
