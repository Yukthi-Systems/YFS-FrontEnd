import { Music, Video } from "lucide-react";
import type { FileItem } from "../../types/file";

export function MediaPlayer({ item, size = "compact" }: { item: FileItem; size?: "compact" | "full" }) {
  const isFull = size === "full";

  if (item.type === "video") {
    if (item.blobUrl) {
      return (
        <video
          src={item.blobUrl}
          controls
          autoPlay={isFull}
          className={`w-full rounded-lg outline-none shadow-sm ${isFull ? "max-h-[75vh]" : "max-h-[160px]"}`}
        />
      );
    }
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-8">
        <Video className="w-12 h-12 text-rose-400" />
        <div className="text-xs font-medium">Seeded demo item — no video content to play.</div>
      </div>
    );
  }

  // audio
  return (
    <div className="flex flex-col items-center gap-4 w-full px-2 py-4">
      <div className="flex items-end gap-1.5 h-10">
        <div className="w-1 h-3 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate]"></div>
        <div className="w-1 h-5 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.2s]"></div>
        <div className="w-1 h-8 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.4s]"></div>
        <div className="w-1 h-6 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.1s]"></div>
        <div className="w-1 h-4 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.3s]"></div>
        <div className="w-1 h-2 bg-accent rounded-full animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.5s]"></div>
      </div>
      {item.blobUrl ? (
        <>
          <Music className="w-6 h-6 text-accent" />
          <audio src={item.blobUrl} controls autoPlay={isFull} className="w-full h-8 outline-none" />
        </>
      ) : (
        <div className="text-xs text-text-main text-center">Seeded demo item — no audio content to play.</div>
      )}
    </div>
  );
}
