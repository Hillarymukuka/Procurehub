import { ReactNode, useState } from "react";
import { Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "./Modal";
import TimezoneSettings from "./TimezoneSettings";
import HelpChatbot from "./HelpChatbot";

interface LayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ title, subtitle, actions, children }) => {
  const { user, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Format role display for HOD users
  const getRoleDisplay = () => {
    if (user?.role === "HeadOfDepartment" && user?.department_name) {
      return `Head of Department (${user.department_name})`;
    }
    return user?.role;
  };

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-primary/60 bg-gradient-to-l from-primary via-primary to-secondary">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
          <div>
            <h1 className="text-2xl font-semibold text-sand">{title}</h1>
            {subtitle ? <p className="text-sm text-sand/70">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-4 text-sand/80">
            {actions ? <div className="flex items-center gap-2 text-sand/80">{actions}</div> : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-sand">{user?.full_name}</p>
              <p className="text-xs uppercase tracking-wide text-sand/70">{getRoleDisplay()}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-secondary bg-sand px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary hover:text-sand"
            >
              Logout
            </button>
            {(user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "procurement") && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-secondary bg-sand text-primary transition hover:bg-secondary hover:text-sand focus:outline-none focus:ring-2 focus:ring-secondary/40"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <Modal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="User Settings">
        <div className="space-y-4">
          <TimezoneSettings />
        </div>
      </Modal>
      <HelpChatbot />
    </div>
  );
};

export default Layout;
