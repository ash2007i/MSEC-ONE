import {
  FormEvent,
  ReactNode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import feedNavLogo from "./assets/msgi-feed-nav.png";
import { useAuth } from "./backend/AuthContext";
import {
  resetPassword as backendResetPassword,
  signIn as backendSignIn,
  signOut as backendSignOut,
  signUp as backendSignUp,
} from "./backend/auth";
import {
  getDepartments,
  updateMyProfile,
  type Department,
} from "./backend/profile";
import {
  getAdminStats,
  getPendingVerifications,
  reviewVerification,
  type AdminStats,
  type PendingVerificationItem,
} from "./backend/admin";
import { supabase } from "./backend/supabase";
import { createMessagingStore, type MessagingStore } from "./messaging/model";
import { CommunityFeed } from "./feed/CommunityFeed";
import {
  Avatar,
  BrandBar,
  FrostedIcon,
  GlassPanel,
  Icon,
  Logo,
  MainHeader,
  TopBar,
  VerifyBadge,
  type AvatarPerson,
  type IconName,
} from "./ui/chrome";
import {
  getSharedSocialLinks,
  socialPlatforms,
  toSocialLinksDraft,
  validateSocialLinks,
  type AlumniId,
  type AlumniSocialLinksRecord,
  type SocialLinkErrors,
  type SocialLinks,
  type SocialLinksDraft,
  type SocialPlatform,
} from "./profile/socialLinks";
import { ProfilePreview, ProfileUnavailable, socialPlatformIcons } from "./profile/ProfilePreview";
import { createTranslator, localeFor, type Translator } from "./settings/i18n";
import {
  buildProfileShareUrl,
  clearStoredSettings,
  createCurrentSession,
  createDefaultSettings,
  createSampleAccount,
  loadSettings,
  parseSharedProfileId,
  resolveTheme,
  saveSettings,
  type LoginEvent,
  type ResolvedTheme,
  type SettingsSection,
  type UserSettings,
} from "./settings/model";
import type { ReportablePerson, SettingsRoute } from "./settings/ui";

const MessagingInbox = lazy(() =>
  import("./messaging/Messaging").then((module) => ({ default: module.MessagingInbox })),
);
const ConversationScreen = lazy(() =>
  import("./messaging/Messaging").then((module) => ({ default: module.ConversationScreen })),
);
const SettingsFlow = lazy(() => import("./settings/SettingsFlow"));

type Screen = "home" | "directory" | "map" | "feed" | "inbox" | "profile" | "admin";
type AuthView = "login" | "register";
type Overlay =
  | "none"
  | "person"
  | "chat"
  | "events"
  | "edit"
  | "settings"
  | "preview"
  | "unavailable";

const fallbackAccount = createSampleAccount();
const currentAlumniId: AlumniId = fallbackAccount.id;
const defaultHeadline = "Building thoughtful tools for growing teams.";

/** Adds this device as the current session; a fresh sign-in is also recorded as login activity. */
function withCurrentSession(settings: UserSettings, recordLogin: boolean): UserSettings {
  const session = createCurrentSession();
  const login: LoginEvent = {
    id: `login-${Date.now()}`,
    device: session.device,
    type: session.type,
    location: session.location,
    time: session.lastActive,
    status: "success",
  };
  return {
    ...settings,
    security: {
      ...settings.security,
      sessions: [session, ...settings.security.sessions.filter((item) => !item.current)],
      loginActivity: recordLogin
        ? [login, ...settings.security.loginActivity].slice(0, 12)
        : settings.security.loginActivity,
    },
  };
}

function removeSharedProfileParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("alumni")) return;
  url.searchParams.delete("alumni");
  window.history.replaceState(window.history.state, "", url);
}

const prefersDark = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);

const people = [
  {
    id: 1,
    name: "Priya Raman",
    dept: "Information Technology",
    year: "2024",
    role: "Software Engineer",
    company: "Zoho",
    city: "Chennai",
    distance: "2.4 km",
    image:
      "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?auto=format&fit=crop&w=300&q=85",
  },
  {
    id: 2,
    name: "Karthik Raj",
    dept: "Mechanical Engineering",
    year: "2019",
    role: "Program Manager",
    company: "Royal Enfield",
    city: "Chennai",
    distance: "4.8 km",
    image:
      "https://images.unsplash.com/photo-1589386417686-0d34b5903d23?auto=format&fit=crop&w=300&q=85",
  },
  {
    id: 3,
    name: "Siddharth Menon",
    dept: "Computer Science",
    year: "2018",
    role: "Engineering Lead",
    company: "Infosys",
    city: "Bengaluru",
    distance: "—",
    image:
      "https://images.unsplash.com/photo-1737574821698-862e77f044c1?auto=format&fit=crop&w=300&q=85",
  },
  {
    id: 4,
    name: "Anjali Krishnan",
    dept: "Electronics & Communication",
    year: "2021",
    role: "Product Designer",
    company: "Intel",
    city: "Bengaluru",
    distance: "—",
    image:
      "https://images.unsplash.com/photo-1609371497456-3a55a205d5eb?auto=format&fit=crop&w=300&q=85",
  },
];

const conversations = [
  {
    ...people[0],
    preview: "I can introduce you to our hiring team.",
    time: "10:32",
    unread: 2,
    online: true,
  },
  {
    ...people[1],
    preview: "Shared an event: Chennai Alumni Circle",
    time: "09:15",
    unread: 0,
    online: true,
  },
  {
    ...people[2],
    preview: "You: That works. See you there!",
    time: "Yesterday",
    unread: 0,
    online: false,
  },
  { ...people[3], preview: "Could you review my portfolio?", time: "Mon", unread: 0, online: true },
];

function BottomNav({
  screen,
  setScreen,
  t,
  isAdmin,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  t: Translator;
  isAdmin: boolean;
}) {
  const items: { key: Screen; icon: IconName; label: string }[] = [
    { key: "home", icon: "home", label: t("nav.home") },
    { key: "map", icon: "map", label: t("nav.map") },
    { key: "feed", icon: "feed", label: "Feed" },
    { key: "inbox", icon: "message", label: t("nav.inbox") },
    { key: "directory", icon: "users", label: t("nav.directory") },
    ...(isAdmin ? [{ key: "admin" as const, icon: "shield" as const, label: "Admin" }] : []),
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map((item) => (
        <button
          key={item.key}
          className={`${screen === item.key ? "active" : ""} ${item.key === "feed" ? "nav-feed" : ""}`}
          aria-label={item.label}
          aria-current={screen === item.key ? "page" : undefined}
          onClick={() => setScreen(item.key)}
        >
          <span className="nav-icon">
            {item.key === "feed" ? (
              <img className="feed-nav-logo" src={feedNavLogo} alt="" aria-hidden />
            ) : (
              <Icon name={item.icon} size={25} />
            )}
            {item.key === "inbox" && <b>2</b>}
          </span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

function Auth({
  onSignedIn,
  notice,
}: {
  onSignedIn: (preferAdmin: boolean) => void;
  notice?: string | null;
}) {
  const [view, setView] = useState<AuthView>("login");
  const [roleTab, setRoleTab] = useState<"Alumni" | "Admin">("Alumni");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [graduationYear, setGraduationYear] = useState("2025");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "register") return;
    getDepartments()
      .then((list) => {
        setDepartments(list);
        if (list.length && !departmentId) setDepartmentId(list[0].id);
      })
      .catch(() => {
        // Fallback options render if departments require auth under RLS.
      });
  }, [view, departmentId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      if (view === "register") {
        const fullName = `${firstName} ${lastName}`.trim();
        const result = await backendSignUp({
          email,
          password,
          fullName,
          role: "alumni",
          graduationYear: Number(graduationYear) || undefined,
          departmentId: departmentId || undefined,
        });
        if (result.session) {
          onSignedIn(false);
        } else {
          setSuccess(true);
        }
      } else {
        await backendSignIn(email, password);
        onSignedIn(roleTab === "Admin");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg("Enter your email address first to receive a password reset link.");
      return;
    }
    setLoading(true);
    try {
      await backendResetPassword(email);
      setInfoMsg("Password reset link sent. Check your inbox.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not send password reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setErrorMsg(null);
    setInfoMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErrorMsg(error.message);
  }

  if (success)
    return (
      <main className="auth-screen">
        <div className="success-card">
          <div className="success-icon">
            <Icon name="check" size={30} />
          </div>
          <p className="eyebrow">APPLICATION RECEIVED</p>
          <h1>Check your email to verify.</h1>
          <p>
            We sent a confirmation link to <b>{email.trim()}</b>. Confirm your email, then sign in
            to access MSGI One.
          </p>
          <button
            className="primary-button"
            onClick={() => {
              setSuccess(false);
              setView("login");
            }}
          >
            Return to sign in
          </button>
        </div>
      </main>
    );

  return (
    <main className="auth-screen">
      <section className="auth-intro">
        <Logo />
        <p>
          Where shared history becomes
          <br />
          professional opportunity.
        </p>
      </section>
      <form className="auth-card" onSubmit={submit}>
        {(notice || infoMsg) && (
          <div className="success-banner auth-notice" role="status">
            <Icon name="info" size={16} />
            {infoMsg ?? notice}
          </div>
        )}
        {errorMsg && (
          <div className="error-banner" role="alert">
            <Icon name="alert" size={16} />
            {errorMsg}
          </div>
        )}
        <div className="auth-card__head">
          <p className="eyebrow">{view === "login" ? "MEMBER ACCESS" : "JOIN THE NETWORK"}</p>
          <h1>{view === "login" ? "Welcome back" : "Create your alumni profile"}</h1>
          <p>
            {view === "login"
              ? "Connect with the MSGI community, wherever your career takes you."
              : "Use your institutional details for faster verification."}
          </p>
        </div>
        {view === "login" && (
          <div className="segmented">
            <button
              type="button"
              onClick={() => setRoleTab("Alumni")}
              className={roleTab === "Alumni" ? "active" : ""}
            >
              Alumni
            </button>
            <button
              type="button"
              onClick={() => setRoleTab("Admin")}
              className={roleTab === "Admin" ? "active" : ""}
            >
              Admin
            </button>
          </div>
        )}
        {view === "register" && (
          <div className="field-row">
            <label>
              <span>First name</span>
              <input
                placeholder="Aarav"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Last name</span>
              <input
                placeholder="Kumar"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
          </div>
        )}
        <label className="field">
          <span>{view === "login" ? "Email" : "Institutional email"}</span>
          <div className="input-wrap">
            <Icon name="mail" size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={view === "login" ? "Enter your email" : "name@msgi.edu.in"}
              required
            />
          </div>
        </label>
        {view === "register" && (
          <div className="field-row">
            <label>
              <span>Department</span>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                {departments.length > 0 ? (
                  departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="">Computer Science</option>
                    <option value="">Information Technology</option>
                    <option value="">Mechanical Engineering</option>
                    <option value="">Electronics & Communication</option>
                  </>
                )}
              </select>
            </label>
            <label>
              <span>Class of</span>
              <select value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)}>
                {Array.from({ length: 15 }, (_, idx) => String(2028 - idx)).map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <label className="field">
          <span>Password</span>
          <div className="input-wrap">
            <Icon name="lock" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              minLength={6}
              required
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <Icon name="eye" size={18} />
            </button>
          </div>
        </label>
        {view === "login" && (
          <button
            type="button"
            className="text-link forgot"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            Forgot password?
          </button>
        )}
        <button className="primary-button" disabled={loading}>
          {loading ? (
            <span className="spinner" />
          ) : view === "login" ? (
            "Sign in securely"
          ) : (
            "Submit for verification"
          )}
          {!loading && <Icon name="arrow" size={18} />}
        </button>
        <div className="auth-switch">
          <span>{view === "login" ? "New to MSGI One?" : "Already a member?"}</span>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setErrorMsg(null);
              setInfoMsg(null);
              setView(view === "login" ? "register" : "login");
            }}
          >
            {view === "login" ? "Create alumni account" : "Sign in"}
          </button>
        </div>
        {view === "login" && (
          <button type="button" className="google-auth-button" onClick={handleGoogleAuth}>
            <span aria-hidden>G</span>
            Continue with Google
          </button>
        )}
      </form>
      <p className="auth-support">
        Need help? <button type="button">Contact alumni support</button>
      </p>
    </main>
  );
}

function SectionHead({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action && (
        <button onClick={onClick}>
          {action}
          <Icon name="chevron" size={15} />
        </button>
      )}
    </div>
  );
}

function MainSectionHeader({
  profile,
  onProfile,
  title,
  action,
}: {
  profile: AvatarPerson;
  onProfile: () => void;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="topbar curved-header">
      <MainHeader person={profile} onProfile={onProfile} />
      <div className="header-title-row">
        <div className="topbar__side" />
        <h1>{title}</h1>
        <div className="topbar__side topbar__side--right">{action}</div>
      </div>
    </header>
  );
}

function HomeScreen({
  navigate,
  openPerson,
  openEvents,
  profile,
  onProfile,
}: {
  navigate: (s: Screen) => void;
  openPerson: (id: number) => void;
  openEvents: () => void;
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [rsvped, setRsvped] = useState(false);
  const firstName = profile.name.trim().split(" ")[0] || "Member";
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
        .format(new Date())
        .toUpperCase(),
    [],
  );

  return (
    <div className="screen">
      <div className="home-hero curved-header">
        <MainHeader person={profile} onProfile={onProfile} />
        <div className="welcome">
          <p>{todayLabel}</p>
          <h1>
            Welcome back, <em>{firstName}.</em>
          </h1>
          <span>Here’s what’s happening across your network.</span>
        </div>
        <div className="hero-stats">
          <button onClick={() => navigate("map")}>
            <span>
              <Icon name="compass" size={18} />
            </span>
            <div>
              <strong>18</strong>
              <small>nearby alumni</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
          <button onClick={openEvents}>
            <span>
              <Icon name="briefcase" size={18} />
            </span>
            <div>
              <strong>12</strong>
              <small>new opportunities</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>
      <div className="content home-content">
        <GlassPanel className="focus-board">
          <SectionHead
            title="Alumni in focus"
            action="Explore"
            onClick={() => navigate("directory")}
          />
          <div className="people-scroll">
            {people.map((person, i) => (
              <button className="person-mini" key={person.id} onClick={() => openPerson(person.id)}>
                <div>
                  <Avatar person={person} size="lg" online={i < 2} />
                  <span className="verify-dot">
                    <Icon name="check" size={10} />
                  </span>
                </div>
                <strong>{person.name.split(" ")[0]}</strong>
                <small>{person.company}</small>
              </button>
            ))}
          </div>
        </GlassPanel>
        <GlassPanel className="home-section">
          <SectionHead title="For your next move" action="View all" onClick={openEvents} />
          <article className="feature-opportunity">
            <div className="feature-top">
              <span className="company-tile">Z</span>
              <div>
                <p className="eyebrow">ALUMNI REFERRAL · ZOHO</p>
                <h3>Senior Product Engineer</h3>
                <span>Chennai · Hybrid · Posted by Priya</span>
              </div>
            </div>
            <p>
              Build products used by millions. Alumni applications are reviewed on priority until
              Friday.
            </p>
            <div className="card-actions">
              <div className="avatar-stack">
                {people.slice(0, 3).map((p) => (
                  <Avatar key={p.id} person={p} size="sm" />
                ))}
                <small>6 alumni work here</small>
              </div>
              <button onClick={openEvents}>
                View role <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        </GlassPanel>
        <hr className="home-section-divider" />
        <GlassPanel className="home-section home-coming-up">
          <SectionHead title="Coming up" action="Calendar" onClick={openEvents} />
          <article className="event-card">
            <div className="date-block">
              <strong>28</strong>
              <span>MAR</span>
            </div>
            <div className="event-info">
              <p className="eyebrow">CHENNAI CHAPTER</p>
              <h3>Leaders’ Table: Building for scale</h3>
              <span>
                <Icon name="pin" size={14} /> The Leela Palace · 6:30 PM
              </span>
              <div>
                <b>42 attending</b>
                <button className={rsvped ? "rsvped" : ""} onClick={() => setRsvped(!rsvped)}>
                  {rsvped ? "Going" : "RSVP"}
                  {rsvped && <Icon name="check" size={14} />}
                </button>
              </div>
            </div>
          </article>
        </GlassPanel>
        <button className="announcement" onClick={openEvents}>
          <span>
            <Icon name="spark" />
          </span>
          <div>
            <p className="eyebrow">FROM MSGI</p>
            <strong>Distinguished Alumni Awards 2025</strong>
            <small>Nominations close 30 March</small>
          </div>
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

function AdminScreen({
  profile,
  onProfile,
}: {
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, pendingData] = await Promise.all([
        getAdminStats(),
        getPendingVerifications(),
      ]);
      setStats(statsData);
      setPending(pendingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin console.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  async function handleReview(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewVerification(id, decision);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update verification.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="screen">
      <MainSectionHeader profile={profile} onProfile={onProfile} title="Admin console" />
      <div className="content">
        {error && (
          <div className="error-banner" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </div>
        )}
        <GlassPanel className="profile-section">
          <p className="eyebrow">NETWORK OVERVIEW</p>
          <h2>Live platform metrics</h2>
          {loading && !stats ? (
            <p>Loading metrics…</p>
          ) : (
            <div className="detail-grid">
              <span>
                <small>Total members</small>
                <b>{stats?.totalUsers ?? 0}</b>
              </span>
              <span>
                <small>Verified alumni</small>
                <b>{stats?.verifiedAlumni ?? 0}</b>
              </span>
              <span>
                <small>Pending reviews</small>
                <b>{stats?.pendingVerifications ?? 0}</b>
              </span>
              <span>
                <small>Live posts</small>
                <b>{stats?.publishedPosts ?? 0}</b>
              </span>
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="profile-section">
          <p className="eyebrow">VERIFICATION QUEUE</p>
          <h2>Pending alumni requests ({pending.length})</h2>
          {!loading && pending.length === 0 ? (
            <p>All verification requests have been reviewed.</p>
          ) : (
            <div className="directory-list">
              {pending.map((item) => (
                <article className="alumni-card" key={item.id}>
                  <div className="alumni-main">
                    <Avatar
                      person={{
                        name: item.applicant?.full_name || "Alumni applicant",
                        image: item.applicant?.avatar_url ?? undefined,
                      }}
                      size="md"
                    />
                    <div>
                      <h3>{item.applicant?.full_name || "Unnamed member"}</h3>
                      <p>{item.institution_email || "No institutional email provided"}</p>
                      <small>Class of {item.graduation_year ?? "—"}</small>
                    </div>
                  </div>
                  <div className="alumni-actions">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleReview(item.id, "rejected")}
                    >
                      <Icon name="close" size={15} /> Reject
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleReview(item.id, "approved")}
                    >
                      <Icon name="check" size={15} /> Approve
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

function DirectoryScreen({
  openPerson,
  profile,
  onProfile,
}: {
  openPerson: (id: number) => void;
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          `${p.name} ${p.company} ${p.city} ${p.dept}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === "All" || p.city === filter || p.dept.includes(filter)),
      ),
    [query, filter],
  );
  return (
    <div className="screen">
      <MainSectionHeader
        profile={profile}
        onProfile={onProfile}
        title="Alumni directory"
        action={
          <button
            className="icon-button"
            onClick={() => setFilterOpen(true)}
            aria-label="Directory filters"
          >
            <Icon name="sliders" />
          </button>
        }
      />
      <div className="content directory-content">
        <GlassPanel className="directory-controls">
          <div className="search-box">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, company, city or department"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
          <div className="chips">
            {["All", "Chennai", "Bengaluru", "Computer"].map((c) => (
              <button onClick={() => setFilter(c)} className={filter === c ? "active" : ""} key={c}>
                {c}
              </button>
            ))}
          </div>
        </GlassPanel>
        <div className="result-summary">
          <span>
            <b>{filtered.length}</b> alumni found
          </span>
          <span>Verified members only</span>
        </div>
        <div className="directory-list">
          {filtered.map((person) => (
            <article className="alumni-card" key={person.id}>
              <button className="alumni-main" onClick={() => openPerson(person.id)}>
                <Avatar person={person} size="lg" />
                <div>
                  <div className="name-line">
                    <h3>{person.name}</h3>
                    <span title="Verified">
                      <Icon name="check" size={11} />
                    </span>
                  </div>
                  <p>
                    {person.role} at <b>{person.company}</b>
                  </p>
                  <small>
                    {person.dept} · Class of {person.year}
                  </small>
                  <small>
                    <Icon name="pin" size={13} />
                    {person.city}
                  </small>
                </div>
                <Icon name="chevron" className="muted" />
              </button>
              <div className="alumni-actions">
                <span>
                  {person.distance !== "—" ? `${person.distance} away` : "Location shared"}
                </span>
                <button onClick={() => openPerson(person.id)}>
                  <Icon name="message" size={16} /> Message
                </button>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <div>
              <Icon name="search" />
            </div>
            <h3>No alumni found</h3>
            <p>Try a different name, company or location.</p>
            <button
              onClick={() => {
                setQuery("");
                setFilter("All");
              }}
            >
              Clear search
            </button>
          </div>
        )}
      </div>
      {filterOpen && (
        <div className="sheet-backdrop" onClick={() => setFilterOpen(false)}>
          <section
            className="bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Directory filters"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div>
                <p className="eyebrow">REFINE RESULTS</p>
                <h2>Directory filters</h2>
              </div>
              <button onClick={() => setFilterOpen(false)} aria-label="Close filters">
                <Icon name="close" />
              </button>
            </div>
            <label>
              Graduation year
              <div className="chips">
                <button>2018–2020</button>
                <button className="active">2021–2024</button>
                <button>2025</button>
              </div>
            </label>
            <label>
              Department
              <select>
                <option>All departments</option>
                <option>Computer Science</option>
                <option>Information Technology</option>
              </select>
            </label>
            <label>
              Location
              <select>
                <option>Any location</option>
                <option>Chennai</option>
                <option>Bengaluru</option>
              </select>
            </label>
            <label className="check-row">
              <span>
                <Icon name="shield" />
                Verified alumni only
              </span>
              <input type="checkbox" defaultChecked />
            </label>
            <button className="primary-button" onClick={() => setFilterOpen(false)}>
              Show {filtered.length} alumni
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function MapScreen({
  openPerson,
  profile,
  onProfile,
}: {
  openPerson: (id: number) => void;
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [selected, setSelected] = useState(people[0]);
  return (
    <div className="screen map-screen">
      <div className="map-canvas">
        <div className="map-grid" />
        <div className="map-water" />
        <div className="road road--one" />
        <div className="road road--two" />
        <div className="road road--three" />
        <div className="map-header curved-header">
          <MainHeader person={profile} onProfile={onProfile} />
          <div className="map-title-row">
            <h1>Alumni map</h1>
            <button className="icon-button">
              <Icon name="sliders" />
            </button>
          </div>
        </div>
        <div className="map-search search-box">
          <Icon name="search" />
          <input placeholder="Search a city or area" />
        </div>
        <span className="area-label area-one">T. NAGAR</span>
        <span className="area-label area-two">ADYAR</span>
        <span className="area-label area-three">GUINDY</span>
        {people.slice(0, 3).map((p, i) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            aria-label={`Show ${p.name} on map`}
            aria-pressed={selected.id === p.id}
            className={`map-marker marker-${i + 1} ${selected.id === p.id ? "active" : ""}`}
          >
            <Avatar person={p} size="sm" />
            <span>{i === 1 ? "4" : ""}</span>
          </button>
        ))}
        <button className="locate-button">
          <Icon name="compass" />
        </button>
        <div className="privacy-note">
          <Icon name="shield" size={15} />
          Only alumni who share their location appear here
        </div>
        <article className="map-preview">
          <div className="map-preview__top">
            <Avatar person={selected} size="lg" online />
            <div>
              <VerifyBadge />
              <h3>{selected.name}</h3>
              <p>
                {selected.role} · {selected.company}
              </p>
              <small>
                <Icon name="pin" size={13} />
                {selected.city} · {selected.distance}
              </small>
            </div>
          </div>
          <div>
            <button onClick={() => openPerson(selected.id)}>View profile</button>
            <button className="navy" onClick={() => openPerson(selected.id)}>
              <Icon name="message" size={16} />
              Message
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}

function InboxScreen({
  openChat,
  store,
  profile,
  onProfile,
}: {
  openChat: (id: number) => void;
  store: MessagingStore;
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="screen flex items-center justify-center"
          role="status"
          aria-label="Loading inbox"
        >
          Loading inbox…
        </div>
      }
    >
      <MessagingInbox
        store={store}
        openChat={openChat}
        renderHeader={(_compose, search) => (
          <MainSectionHeader
            profile={profile}
            onProfile={onProfile}
            title="Inbox"
            action={
              <button className="icon-button" aria-label="Search conversations" onClick={search}>
                <Icon name="search" />
              </button>
            }
          />
        )}
      />
    </Suspense>
  );
}

function ChatScreen({
  id,
  onBack,
  viewProfile,
  store,
}: {
  id: number;
  onBack: () => void;
  viewProfile: () => void;
  store: MessagingStore;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="screen flex items-center justify-center"
          role="status"
          aria-label="Loading conversation"
        >
          Loading conversation…
        </div>
      }
    >
      <ConversationScreen
        key={id}
        id={id}
        store={store}
        onBack={onBack}
        viewProfile={viewProfile}
      />
    </Suspense>
  );
}

function ProfileScreen({
  account,
  headline,
  bio,
  linkedinUrl,
  locationVisible,
  setLocationVisible,
  openSettings,
  edit,
  isAdmin,
  openAdmin,
}: {
  account: UserSettings["account"];
  headline: string;
  bio: string;
  linkedinUrl?: string | null;
  locationVisible: boolean;
  setLocationVisible: (visible: boolean) => void;
  openSettings: (route: SettingsRoute) => void;
  edit: () => void;
  isAdmin: boolean;
  openAdmin: () => void;
}) {
  const person = { name: account.fullName, role: account.role, image: account.avatar };
  return (
    <div className="screen profile-screen">
      <div className="profile-hero">
        <BrandBar
          action={
            <button className="icon-button" onClick={edit} aria-label="Edit profile details">
              <Icon name="edit" />
            </button>
          }
        />
        <div className="profile-identity glass-panel">
          <Avatar person={person} size="xl" />
          <div>
            {account.verified && <VerifyBadge />}
            <h1>{account.fullName}</h1>
            <p>
              {account.role}
              {account.company ? ` at ${account.company}` : ""}
            </p>
            <span>
              {account.department}
              {account.graduationYear ? ` · Class of ${account.graduationYear}` : ""}
            </span>
          </div>
        </div>
      </div>
      <div className="content profile-content">
        <div className="profile-actions glass-panel">
          <button onClick={edit}>
            <FrostedIcon name="edit" />
            Edit profile
          </button>
          <button
            onClick={() => {
              if (linkedinUrl) window.open(linkedinUrl, "_blank", "noopener,noreferrer");
              else edit();
            }}
          >
            <FrostedIcon name="linkedin" />
            LinkedIn
          </button>
          <button onClick={() => openSettings("main")}>
            <FrostedIcon name="settings" />
            Settings
          </button>
        </div>
        <GlassPanel className="profile-section">
          <p className="eyebrow">PROFESSIONAL IDENTITY</p>
          <h2>{headline}</h2>
          {bio && <p>{bio}</p>}
          <div className="detail-grid">
            <span>
              <small>Current role</small>
              <b>{account.role || "—"}</b>
            </span>
            <span>
              <small>Company</small>
              <b>{account.company || "—"}</b>
            </span>
            <span>
              <small>Location</small>
              <b>{account.city ? `${account.city}, India` : "Not set"}</b>
            </span>
            <span>
              <small>Status</small>
              <b>{account.verified ? "Verified alumni" : "Pending verification"}</b>
            </span>
          </div>
        </GlassPanel>
        <section className="privacy-card">
          <div className="privacy-card__icon">
            <Icon name="shield" />
          </div>
          <div>
            <p className="eyebrow">PRIVACY CONTROL</p>
            <h3>Location visibility</h3>
            <p>
              Show your city and approximate distance to verified alumni. Your precise location is
              never shared.
            </p>
          </div>
          <button
            onClick={() => setLocationVisible(!locationVisible)}
            className={`toggle ${locationVisible ? "on" : ""}`}
            aria-label="Toggle location visibility"
            role="switch"
            aria-checked={locationVisible}
          >
            <span />
          </button>
          <div className="privacy-status">
            <Icon name={locationVisible ? "check" : "lock"} size={14} />
            {locationVisible ? "Visible to verified alumni" : "Location hidden"}
          </div>
        </section>
        <GlassPanel className="settings-actions">
          {isAdmin && (
            <button className="menu-row" onClick={openAdmin}>
              <span>
                <FrostedIcon name="shield" />
                Admin console
              </span>
              <Icon name="chevron" />
            </button>
          )}
          <button className="menu-row" onClick={() => openSettings("privacy")}>
            <span>
              <FrostedIcon name="shield" />
              Privacy & account
            </span>
            <Icon name="chevron" />
          </button>
          <button className="menu-row" onClick={() => openSettings("main")}>
            <span>
              <FrostedIcon name="settings" />
              Settings
            </span>
            <Icon name="chevron" />
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}

function PersonProfile({
  id,
  socialLinks,
  onBack,
  message,
}: {
  id: AlumniId;
  socialLinks?: SocialLinks;
  onBack: () => void;
  message: () => void;
}) {
  const p = people.find((x) => x.id === id) || people[0];
  const sharedLinks = getSharedSocialLinks(socialLinks);
  const [connected, setConnected] = useState(false);
  return (
    <div className="screen person-profile">
      <TopBar
        title="Alumni profile"
        onBack={onBack}
        action={
          <button className="icon-button">
            <Icon name="spark" />
          </button>
        }
      />
      <div className="person-cover">
        <div className="person-card glass-panel">
          <Avatar person={p} size="xl" />
          <VerifyBadge />
          <h1>{p.name}</h1>
          <p>
            {p.role} at {p.company}
          </p>
          <span>
            {p.dept} · Class of {p.year}
          </span>
          <small>
            <Icon name="pin" size={13} />
            {p.city} · Location shared
          </small>
          <div>
            <button
              className={connected ? "connected" : ""}
              onClick={() => setConnected(!connected)}
            >
              {connected ? (
                <>
                  <Icon name="check" size={16} />
                  Connected
                </>
              ) : (
                "Connect"
              )}
            </button>
            <button onClick={message}>
              <Icon name="message" size={16} />
              Message
            </button>
          </div>
        </div>
      </div>
      <div className="content person-details">
        <section>
          <p className="eyebrow">ABOUT</p>
          <h2>Creating reliable products at the intersection of people and technology.</h2>
          <p>
            I enjoy mentoring early-career engineers and helping alumni navigate opportunities in
            product-led companies.
          </p>
        </section>
        {sharedLinks.length > 0 && (
          <section aria-labelledby="social-profiles-title">
            <p className="eyebrow" id="social-profiles-title">
              SOCIAL PROFILES
            </p>
            <div className="social-links">
              {sharedLinks.map((link) => (
                <a
                  key={link.key}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${p.name}'s ${link.label} in a new tab`}
                >
                  <span className="frosted-icon">
                    <Icon name={socialPlatformIcons[link.key]} size={18} />
                  </span>
                  <b>{link.label}</b>
                  <Icon name="external" size={14} />
                </a>
              ))}
            </div>
          </section>
        )}
        <section>
          <p className="eyebrow">EXPERIENCE</p>
          <div className="experience">
            <span>{p.company.charAt(0)}</span>
            <div>
              <h3>{p.role}</h3>
              <p>{p.company}</p>
              <small>2022 — Present · {p.city}</small>
            </div>
          </div>
        </section>
        <section>
          <p className="eyebrow">OPEN TO</p>
          <div className="skill-list">
            <span>Mentoring</span>
            <span>Referrals</span>
            <span>Speaking</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function EventsScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState("Events");
  const [applied, setApplied] = useState(false);
  return (
    <div className="screen">
      <TopBar title="Events & opportunities" onBack={onBack} />
      <div className="content events-content">
        <div className="inbox-tabs">
          <button className={tab === "Events" ? "active" : ""} onClick={() => setTab("Events")}>
            Events
          </button>
          <button
            className={tab === "Opportunities" ? "active" : ""}
            onClick={() => setTab("Opportunities")}
          >
            Opportunities
          </button>
        </div>
        <div className="editorial-head">
          <p className="eyebrow">
            {tab === "Events" ? "CURATED FOR CHENNAI" : "CURATED FOR YOUR PROFILE"}
          </p>
          <h1>{tab === "Events" ? "Meet, learn and reconnect." : "Your next move starts here."}</h1>
        </div>
        {tab === "Events" ? (
          <div className="event-list">
            <article className="large-event">
              <div className="event-visual">
                <span>
                  28
                  <br />
                  <small>MAR</small>
                </span>
                <b>FEATURED</b>
              </div>
              <div>
                <p className="eyebrow">LEADERS’ TABLE</p>
                <h2>Building for scale: Chennai’s product story</h2>
                <p>
                  Join senior alumni for an intimate evening of ideas, introductions and dinner.
                </p>
                <span>
                  <Icon name="pin" size={14} />
                  The Leela Palace · 6:30 PM
                </span>
                <button>
                  Reserve your seat <Icon name="arrow" size={15} />
                </button>
              </div>
            </article>
            <article className="simple-event">
              <div className="date-block">
                <strong>05</strong>
                <span>APR</span>
              </div>
              <div>
                <p className="eyebrow">VIRTUAL WORKSHOP</p>
                <h3>Career storytelling for leaders</h3>
                <span>Online · 11:00 AM</span>
              </div>
              <button>
                <Icon name="chevron" />
              </button>
            </article>
          </div>
        ) : (
          <div className="opportunity-list">
            <article>
              <div className="opportunity-head">
                <span className="company-tile">Z</span>
                <div>
                  <small>ZOHO</small>
                  <h3>Senior Product Engineer</h3>
                  <p>Chennai · Hybrid</p>
                </div>
                <VerifyBadge label="Referral" />
              </div>
              <p>Design and build reliable systems used by growing businesses worldwide.</p>
              <div className="skill-list">
                <span>React</span>
                <span>TypeScript</span>
                <span>5+ years</span>
              </div>
              <button
                onClick={() => setApplied(!applied)}
                className={applied ? "success-button" : ""}
              >
                {applied ? (
                  <>
                    <Icon name="check" />
                    Application noted
                  </>
                ) : (
                  <>
                    Apply with referral <Icon name="arrow" />
                  </>
                )}
              </button>
            </article>
            <article>
              <div className="opportunity-head">
                <span className="company-tile blue">F</span>
                <div>
                  <small>FRESHWORKS</small>
                  <h3>Product Design Lead</h3>
                  <p>Chennai · Flexible</p>
                </div>
              </div>
              <p>Lead design for a new generation of AI-assisted customer tools.</p>
              <button>
                View opportunity <Icon name="arrow" />
              </button>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

function EditProfile({
  alumniId,
  account,
  initialHeadline,
  initialBio,
  socialLinks,
  onSaveSocialLinks,
  onSavedProfile,
  onBack,
}: {
  alumniId: AlumniId;
  account: UserSettings["account"];
  initialHeadline: string;
  initialBio: string;
  socialLinks?: SocialLinks;
  onSaveSocialLinks: (record: AlumniSocialLinksRecord) => void;
  onSavedProfile: () => Promise<void>;
  onBack: () => void;
}) {
  const [headline, setHeadline] = useState(initialHeadline);
  const [jobTitle, setJobTitle] = useState(account.role);
  const [company, setCompany] = useState(account.company);
  const [city, setCity] = useState(account.city);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [socialDraft, setSocialDraft] = useState<SocialLinksDraft>(() =>
    toSocialLinksDraft(socialLinks),
  );
  const [socialErrors, setSocialErrors] = useState<SocialLinkErrors>({});
  const hasSocialErrors = Object.keys(socialErrors).length > 0;

  const updateSocialLink = (platform: SocialPlatform, value: string) => {
    setSaved(false);
    setSocialDraft((draft) => ({ ...draft, [platform]: value }));
    setSocialErrors(({ [platform]: _removed, ...errors }) => errors);
  };

  const save = async () => {
    const { links, errors } = validateSocialLinks(socialDraft);
    setSocialErrors(errors);
    if (Object.keys(errors).length) {
      setSaved(false);
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateMyProfile({
        headline: headline.trim() || null,
        job_title: jobTitle.trim() || null,
        company: company.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        linkedin_url: links.linkedin ?? null,
        website_url: links.website ?? null,
      });
      onSaveSocialLinks({ alumniId, links, updatedAt: new Date().toISOString() });
      setSocialDraft(toSocialLinksDraft(links));
      await onSavedProfile();
      setSaved(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <TopBar
        title="Edit profile"
        onBack={onBack}
        action={
          <button className="save-link" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />
      <div className="content edit-content">
        {saved && (
          <div className="success-banner" role="status">
            <Icon name="check" />
            Profile updated successfully
          </div>
        )}
        {(hasSocialErrors || saveError) && (
          <div className="error-banner" role="alert">
            <Icon name="close" />
            {saveError ?? "Check the highlighted social links before saving."}
          </div>
        )}
        <div className="edit-photo glass-panel">
          <Avatar
            person={{ name: account.fullName, role: account.role, image: account.avatar }}
            size="xl"
          />
          <button type="button">
            <Icon name="edit" size={16} />
          </button>
          <div>
            <h3>{account.fullName}</h3>
            <p>Profile photo</p>
          </div>
        </div>
        <GlassPanel className="edit-form">
          <p className="form-section-label">PROFESSIONAL DETAILS</p>
          <label className="field">
            <span>Headline</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </label>
          <label className="field">
            <span>Job title</span>
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Company</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="field">
            <span>City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="field">
            <span>About</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
        </GlassPanel>
        <GlassPanel className="edit-form social-form">
          <p className="form-section-label">SOCIAL MEDIA LINKS</p>
          <p className="form-help">
            Add only the profiles you want verified alumni to see. Empty fields stay hidden.
          </p>
          {socialPlatforms.map((platform) => {
            const error = socialErrors[platform.key];
            const inputId = `social-${platform.key}`;
            return (
              <div className="field social-field" key={platform.key}>
                <label htmlFor={inputId}>{platform.label}</label>
                <div className={`input-wrap ${error ? "input-wrap--error" : ""}`}>
                  <Icon name={socialPlatformIcons[platform.key]} size={18} />
                  <input
                    id={inputId}
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={platform.placeholder}
                    value={socialDraft[platform.key]}
                    onChange={(event) => updateSocialLink(platform.key, event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                  />
                </div>
                {error && (
                  <p className="field-error" id={`${inputId}-error`}>
                    {error}
                  </p>
                )}
              </div>
            );
          })}
          <button
            className="primary-button"
            disabled={saving}
            onClick={async () => {
              if (await save()) window.setTimeout(onBack, 700);
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}

const reportablePeople: ReportablePerson[] = people.map(({ id, name, dept, year }) => ({
  id,
  name,
  dept,
  year,
}));

export default function App() {
  const {
    user,
    profile,
    details,
    academicRecords,
    isAuthenticated,
    isAdmin,
    loading: authLoading,
    refreshProfile,
  } = useAuth();

  const [messaging] = useState(() => createMessagingStore(conversations));
  useEffect(() => () => messaging.dispose(), [messaging]);

  const [settings, setSettings] = useState<UserSettings>(() => loadSettings(fallbackAccount));
  const [screen, setScreen] = useState<Screen>("home");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [settingsStack, setSettingsStack] = useState<SettingsRoute[]>([]);
  const [selectedPerson, setSelectedPerson] = useState(1);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [preferAdminTab, setPreferAdminTab] = useState(false);
  const [pendingProfileId, setPendingProfileId] = useState<number | null>(() =>
    typeof window === "undefined" ? null : parseSharedProfileId(window.location.search),
  );
  const [publicViewDismissed, setPublicViewDismissed] = useState(false);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    prefersDark() ? "dark" : "light",
  );
  const [socialLinksByAlumni, setSocialLinksByAlumni] = useState<Record<AlumniId, SocialLinks>>({});

  // Sync Supabase profile + private details + academic records into UI settings.account
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const primaryAcademic = academicRecords.find((r) => r.is_current) ?? academicRecords[0];
    const resolvedName =
      profile?.full_name?.trim() ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "MSGI Member";
    const resolvedRole =
      profile?.job_title ||
      (profile?.role === "admin"
        ? "Administrator"
        : profile?.role === "student"
          ? "Student"
          : "Alumni");

    setSettings((current) =>
      withCurrentSession(
        {
          ...current,
          account: {
            ...current.account,
            fullName: resolvedName,
            email: user.email ?? details?.personal_email ?? current.account.email,
            phone: details?.phone ?? "",
            role: resolvedRole,
            company: profile?.company ?? "",
            city: profile?.city ?? "",
            department: primaryAcademic?.department?.name ?? current.account.department,
            graduationYear: primaryAcademic?.graduation_year
              ? String(primaryAcademic.graduation_year)
              : current.account.graduationYear,
            verified: Boolean(profile?.is_verified),
            avatar: profile?.avatar_url ?? "",
          },
        },
        false,
      ),
    );

    if (profile?.linkedin_url || profile?.website_url) {
      setSocialLinksByAlumni((current) => ({
        ...current,
        [currentAlumniId]: {
          ...current[currentAlumniId],
          ...(profile.linkedin_url ? { linkedin: profile.linkedin_url } : {}),
          ...(profile.website_url ? { website: profile.website_url } : {}),
        },
      }));
    }
  }, [isAuthenticated, user, profile, details, academicRecords]);

  // Gate Admin screen strictly by profile?.role === 'admin'
  useEffect(() => {
    if (preferAdminTab && isAuthenticated && !authLoading) {
      if (isAdmin) setScreen("admin");
      setPreferAdminTab(false);
    }
    if (screen === "admin" && !isAdmin) {
      setScreen("home");
    }
  }, [preferAdminTab, isAuthenticated, authLoading, isAdmin, screen]);

  const ownHeadline = profile?.headline || profile?.bio || defaultHeadline;
  const t = useMemo(() => createTranslator(settings.language), [settings.language]);
  const locale = localeFor(settings.language);
  const { appearance, language, privacy } = settings;
  const resolvedTheme = resolveTheme(appearance.theme, systemTheme === "dark");
  const mainProfile: AvatarPerson = {
    name: settings.account.fullName,
    role: settings.account.role,
    image: settings.account.avatar || undefined,
  };

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.textSize = appearance.textSize;
    root.dataset.motion = appearance.reduceMotion ? "reduced" : "standard";
    root.lang = language;
  }, [resolvedTheme, appearance.textSize, appearance.reduceMotion, language]);

  useEffect(() => {
    if (isAuthenticated) saveSettings(settings);
  }, [settings, isAuthenticated]);

  const update = useCallback(
    <K extends SettingsSection>(
      section: K,
      next: UserSettings[K] | ((current: UserSettings[K]) => UserSettings[K]),
    ) =>
      setSettings((current) => ({
        ...current,
        [section]:
          typeof next === "function"
            ? (next as (value: UserSettings[K]) => UserSettings[K])(current[section])
            : next,
      })),
    [],
  );

  const saveSocialLinks = ({ alumniId, links }: AlumniSocialLinksRecord) =>
    setSocialLinksByAlumni((current) => ({ ...current, [alumniId]: links }));
  const openPerson = (id: number) => {
    setSelectedPerson(id);
    setOverlay("person");
  };
  const openChat = (id: number) => {
    setSelectedPerson(id);
    setOverlay("chat");
  };
  const openSettings = (route: SettingsRoute) => {
    setSettingsStack([route]);
    setOverlay("settings");
  };
  const settingsBack = () => {
    if (settingsStack.length <= 1) {
      setSettingsStack([]);
      setOverlay("none");
    } else setSettingsStack(settingsStack.slice(0, -1));
  };
  const closePreview = () => setOverlay(settingsStack.length ? "settings" : "none");
  const editPrivacyFromPreview = () => {
    setSettingsStack((stack) => [...stack, "privacy"]);
    setOverlay("settings");
  };

  const handleSignedIn = (preferAdmin: boolean) => {
    setSettings((current) => withCurrentSession(current, true));
    setAuthNotice(null);
    setPublicViewDismissed(false);
    setPreferAdminTab(preferAdmin);
    setScreen("home");
    setOverlay("none");
  };

  const logout = async (notice?: string) => {
    try {
      await backendSignOut();
    } catch (err) {
      console.error("Supabase sign-out error:", err);
    }
    setSettings((current) => ({
      ...current,
      security: {
        ...current.security,
        sessions: current.security.sessions.filter((session) => !session.current),
      },
    }));
    setScreen("home");
    setOverlay("none");
    setSettingsStack([]);
    setAuthNotice(notice ?? null);
  };

  const deleteAccount = () => {
    clearStoredSettings(fallbackAccount.id);
    setSocialLinksByAlumni(({ [fallbackAccount.id]: _removed, ...rest }) => rest);
    setSettings(createDefaultSettings(fallbackAccount));
    void logout(t("delete.notice"));
  };

  const profileUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : buildProfileShareUrl(
            { id: settings.account.id, fullName: settings.account.fullName },
            window.location.href,
          ),
    [settings.account.id, settings.account.fullName],
  );

  const sharedTarget =
    pendingProfileId === null
      ? null
      : pendingProfileId === fallbackAccount.id
        ? "self"
        : people.some((person) => person.id === pendingProfileId)
          ? "person"
          : "missing";

  useEffect(() => {
    if (!isAuthenticated || pendingProfileId === null) return;
    if (sharedTarget === "self") setOverlay("preview");
    else if (sharedTarget === "person") {
      setSelectedPerson(pendingProfileId);
      setOverlay("person");
    } else setOverlay("unavailable");
    setSettingsStack([]);
    setPendingProfileId(null);
    removeSharedProfileParam();
  }, [isAuthenticated, pendingProfileId, sharedTarget]);

  if (authLoading && !isAuthenticated) {
    return (
      <div className="app-stage">
        <div className="phone-shell">
          <div className="screen flex items-center justify-center" role="status">
            Restoring session…
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const showPublicProfile =
      sharedTarget === "self" && privacy.profileVisibility === "public" && !publicViewDismissed;
    const linkNotice =
      sharedTarget === "missing"
        ? t("link.invalid")
        : sharedTarget === "self" && privacy.profileVisibility === "private"
          ? t("link.private")
          : sharedTarget && !showPublicProfile
            ? t("link.signIn")
            : null;
    return (
      <div className="app-stage">
        <div className="phone-shell">
          {showPublicProfile ? (
            <ProfilePreview
              account={settings.account}
              privacy={privacy}
              headline={ownHeadline}
              audience="public"
              t={t}
              onBack={() => {
                setPendingProfileId(null);
                removeSharedProfileParam();
              }}
              onSignIn={() => setPublicViewDismissed(true)}
            />
          ) : (
            <Auth onSignedIn={handleSignedIn} notice={linkNotice ?? authNotice} />
          )}
        </div>
        <div className="desktop-note">
          <Logo />
          <h1>A private network for a lifetime of opportunity.</h1>
          <p>
            MSGI One connects verified alumni through meaningful introductions, trusted career
            opportunities and shared institutional pride.
          </p>
          <span>Designed for the MSGI alumni community</span>
        </div>
      </div>
    );
  }

  let content: ReactNode;
  if (overlay === "settings" && settingsStack.length)
    content = (
      <Suspense
        fallback={
          <div className="screen flex items-center justify-center" role="status">
            {t("settings.loading")}
          </div>
        }
      >
        <SettingsFlow
          route={settingsStack[settingsStack.length - 1]}
          depth={settingsStack.length}
          settings={settings}
          update={update}
          t={t}
          locale={locale}
          systemTheme={systemTheme}
          navigate={(route) => setSettingsStack((stack) => [...stack, route])}
          back={settingsBack}
          logout={logout}
          deleteAccount={deleteAccount}
          previewProfile={() => setOverlay("preview")}
          profileUrl={profileUrl}
          reportablePeople={reportablePeople}
        />
      </Suspense>
    );
  else if (overlay === "preview")
    content = (
      <ProfilePreview
        account={settings.account}
        privacy={privacy}
        socialLinks={socialLinksByAlumni[currentAlumniId]}
        headline={ownHeadline}
        audience="owner"
        t={t}
        onBack={closePreview}
        onEditPrivacy={editPrivacyFromPreview}
      />
    );
  else if (overlay === "unavailable")
    content = <ProfileUnavailable t={t} onBack={() => setOverlay("none")} />;
  else if (overlay === "person")
    content = (
      <PersonProfile
        id={selectedPerson}
        socialLinks={socialLinksByAlumni[selectedPerson]}
        onBack={() => setOverlay("none")}
        message={() => setOverlay("chat")}
      />
    );
  else if (overlay === "chat")
    content = (
      <ChatScreen
        store={messaging}
        id={selectedPerson}
        onBack={() => setOverlay("none")}
        viewProfile={() => setOverlay("person")}
      />
    );
  else if (overlay === "events") content = <EventsScreen onBack={() => setOverlay("none")} />;
  else if (overlay === "edit")
    content = (
      <EditProfile
        alumniId={currentAlumniId}
        account={settings.account}
        initialHeadline={profile?.headline ?? ""}
        initialBio={profile?.bio ?? ""}
        socialLinks={socialLinksByAlumni[currentAlumniId]}
        onSaveSocialLinks={saveSocialLinks}
        onSavedProfile={refreshProfile}
        onBack={() => setOverlay("none")}
      />
    );
  else if (screen === "home")
    content = (
      <HomeScreen
        navigate={setScreen}
        openPerson={openPerson}
        openEvents={() => setOverlay("events")}
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
      />
    );
  else if (screen === "directory")
    content = (
      <DirectoryScreen
        openPerson={openPerson}
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
      />
    );
  else if (screen === "map")
    content = (
      <MapScreen
        openPerson={openPerson}
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
      />
    );
  else if (screen === "feed")
    content = <CommunityFeed profile={mainProfile} onProfile={() => setScreen("profile")} />;
  else if (screen === "inbox")
    content = (
      <InboxScreen
        openChat={openChat}
        store={messaging}
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
      />
    );
  else if (screen === "admin" && isAdmin)
    content = <AdminScreen profile={mainProfile} onProfile={() => setScreen("profile")} />;
  else
    content = (
      <ProfileScreen
        account={settings.account}
        headline={ownHeadline}
        bio={profile?.bio ?? ""}
        linkedinUrl={profile?.linkedin_url}
        locationVisible={privacy.locationVisible}
        setLocationVisible={(locationVisible) =>
          update("privacy", (current) => ({ ...current, locationVisible }))
        }
        openSettings={openSettings}
        edit={() => setOverlay("edit")}
        isAdmin={isAdmin}
        openAdmin={() => setScreen("admin")}
      />
    );

  return (
    <div className="app-stage app-stage--signed">
      <div className="phone-shell">
        {content}
        {overlay === "none" && (
          <BottomNav screen={screen} setScreen={setScreen} t={t} isAdmin={isAdmin} />
        )}
      </div>
      <div className="desktop-note">
        <Logo />
        <h1>
          Your MSGI community,
          <br />
          always within reach.
        </h1>
        <p>Explore the interactive prototype in the mobile canvas.</p>
        <div className="desktop-pills">
          <span>Verified network</span>
          <span>Privacy first</span>
          <span>Career focused</span>
        </div>
      </div>
    </div>
  );
}