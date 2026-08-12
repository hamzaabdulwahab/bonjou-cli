import { useCallback, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

import { Landing } from "./Landing";
import { TabTaken } from "./TabTaken";
import { Workspace } from "./Workspace";
import { useSessionOwnership } from "./tabs";
import { useTheme } from "./theme";
import { useSession } from "./useSession";

/**
 * Two surfaces, one bundle.
 *
 * The page at "/" argues for the product; "/app" is the product. They are
 * switched client-side rather than split into two entries because the
 * session has to survive the move: the marketing page shows a live roster,
 * and reconnecting to the relay just to cross a link would drop it.
 *
 * A room link is the exception that sets the rule. Someone opening
 * "/r/{code}" was handed that link by a person who is waiting for them, so
 * it lands in the workspace directly rather than on an argument for it.
 */
type View = "site" | "app";

function viewFromLocation(): View {
  const path = window.location.pathname;
  if (path.startsWith("/r/")) return "app";
  if (path === "/app" || path === "/share") return "app";
  if (new URLSearchParams(window.location.search).get("r")) return "app";
  return "site";
}

function storedName(): string {
  try {
    return localStorage.getItem("bonjou.name") ?? "";
  } catch {
    return "";
  }
}

export default function App() {
  const [name, setName] = useState(storedName);
  const [view, setView] = useState<View>(viewFromLocation);
  const theme = useTheme();
  // One connection per browser. A tab that does not hold the lock never
  // opens a session, so it never becomes a second entry in anyone's list.
  const ownership = useSessionOwnership();
  const owns = ownership.state === "owner";
  const session = useSession(name, Boolean(name) && owns);

  const commitName = useCallback((value: string) => {
    try {
      localStorage.setItem("bonjou.name", value);
    } catch {
      // Private browsing refuses storage. The name still works for this
      // session; it just will not be remembered.
    }
    setName(value);
  }, []);

  const openApp = useCallback(() => {
    if (window.location.pathname !== "/app") {
      window.history.pushState({ view: "app" }, "", "/app");
    }
    setView("app");
    window.scrollTo(0, 0);
  }, []);

  // Back and forward have to work, or the browser's own controls lie.
  useEffect(() => {
    const onPop = () => setView(viewFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The session speaks in one-line notices. sonner renders them as toasts
  // with a live region and a timer, which is what that hand-rolled banner
  // was slowly turning into.
  const { notice, setNotice } = session;
  useEffect(() => {
    if (!notice) return;
    toast(notice);
    setNotice("");
  }, [notice, setNotice]);

  // Only the workspace is a presence. The marketing page reads a roster
  // it does not join, so a blocked tab can still show it.
  if (view === "app" && !owns) {
    return (
      <>
        <TabTaken onTakeOver={ownership.takeOver} />
        <Toaster
          position="bottom-center"
          theme={theme.resolved}
          toastOptions={{ className: "bj-toast" }}
        />
      </>
    );
  }

  return (
    <>
      {view === "app" ? (
        <Workspace
          name={name}
          onName={commitName}
          session={session}
          themeChoice={theme.choice}
          theme={theme.resolved}
          onThemeChoice={theme.setChoice}
          onToggleTheme={theme.toggle}
        />
      ) : (
        <Landing
          session={session}
          onOpenApp={openApp}
          theme={theme.resolved}
          onToggleTheme={theme.toggle}
        />
      )}

      <Toaster
        position="bottom-center"
        theme={theme.resolved}
        toastOptions={{ className: "bj-toast" }}
      />
    </>
  );
}
