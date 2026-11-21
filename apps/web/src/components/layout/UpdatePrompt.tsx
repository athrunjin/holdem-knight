import { useRegisterSW } from "virtual:pwa-register/react";
import { useMessages } from "@/i18n";

/** Prompts for a refresh when a new version is ready. Never forces it during a game; the organizer chooses when. */
export function UpdatePrompt() {
  const m = useMessages();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl bg-text px-4 py-3 text-sm text-bg shadow-lg md:bottom-6 md:left-auto md:w-96"
    >
      <span className="flex-1">{m.shell.update.ready}</span>
      <button type="button" className="px-2 py-1 text-bg/70" onClick={() => setNeedRefresh(false)}>
        {m.shell.update.later}
      </button>
      <button
        type="button"
        className="rounded-lg bg-bg px-3 py-1.5 font-semibold text-text"
        onClick={() => updateServiceWorker(true)}
      >
        {m.common.refresh}
      </button>
    </div>
  );
}
