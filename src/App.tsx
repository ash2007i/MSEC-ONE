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
  getMyVerificationStatus,
  resetPassword as backendResetPassword,
  signIn as backendSignIn,
  signOut as backendSignOut,
  signUp as backendSignUp,
  submitAlumniVerification,
  type AlumniVerification,
} from "./backend/auth";
import {
  getDepartments,
  getProfileById,
  listAlumniDirectory,
  updateMyProfile,
  type AcademicRecord,
  type Department,
  type Profile,
} from "./backend/profile";
import {
  fetchActiveLocations,
  getDeviceCoordinates,
  setLocationSharing,
  subscribeToLiveLocations,
  type LiveLocationRecord,
} from "./backend/location";
import {
  applyToOpportunity,
  cancelEventRegistration,
  createMentorshipRequest,
  getEvents,
  getMyEventRegistrations,
  getOpportunities,
  registerForEvent,
  type AlumniEvent,
  type Opportunity,
} from "./backend/opportunities";
import {
  getAdminStats,
  getPendingVerifications,
  reviewVerification,
  uploadVerificationProof,
  type AdminStats,
  type PendingVerificationItem,
} from "./backend/admin";
import {
  getOrCreateDirectConversation,
  type ChatMemberProfile,
} from "./backend/messaging";
import { supabase } from "./backend/supabase";
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
import {
  ProfilePreview,
  ProfileUnavailable,
  socialPlatformIcons,
} from "./profile/ProfilePreview";
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
import type { SettingsRoute } from "./settings/ui";

const MessagingInbox = lazy(() =>
  import("./messaging/Messaging").then((module) => ({
    default: module.MessagingInbox,
  })),
);
const ConversationScreen = lazy(() =>
  import("./messaging/Messaging").then((module) => ({
    default: module.ConversationScreen,
  })),
);
const SettingsFlow = lazy(() => import("./settings/SettingsFlow"));

type Screen =
  | "home"
  | "directory"
  | "map"
  | "feed"
  | "inbox"
  | "profile"
  | "admin";
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

type DirectoryMember = Profile & { academicRecords: AcademicRecord[] };

const fallbackAccount = createSampleAccount();
const currentAlumniId: AlumniId = fallbackAccount.id;
const defaultHeadline = "Building thoughtful tools for growing teams.";

function primaryAcademicOf(records: AcademicRecord[]) {
  return records.find((r) => r.is_current) ?? records[0] ?? null;
}

function formatDistanceKm(
  a: { latitude: number; longitude: number } | null,
  b: { latitude: number; longitude: number },
): string {
  if (!a) return "Live nearby";
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(h));
  if (km < 1) return `${Math.max(100, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

function formatEventDateParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { day: "--", month: "TBD", time: "" };
  }
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
    time: date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

/** Adds this device as the current session; a fresh sign-in is also recorded as login activity. */
function withCurrentSession(
  settings: UserSettings,
  recordLogin: boolean,
): UserSettings {
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
      sessions: [
        session,
        ...settings.security.sessions.filter((item) => !item.current),
      ],
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
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);

function BottomNav({
  screen,
  setScreen,
  t,
  isAdmin,
  unreadCount,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  t: Translator;
  isAdmin: boolean;
  unreadCount: number;
}) {
  const items: { key: Screen; icon: IconName; label: string }[] = [
    { key: "home", icon: "home", label: t("nav.home") },
    { key: "map", icon: "map", label: t("nav.map") },
    { key: "feed", icon: "feed", label: "Feed" },
    { key: "inbox", icon: "message", label: t("nav.inbox") },
    { key: "directory", icon: "users", label: t("nav.directory") },
    ...(isAdmin
      ? [{ key: "admin" as const, icon: "shield" as const, label: "Admin" }]
      : []),
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
              <img
                className="feed-nav-logo"
                src={feedNavLogo}
                alt=""
                aria-hidden
              />
            ) : (
              <Icon name={item.icon} size={25} />
            )}
            {item.key === "inbox" && unreadCount > 0 && <b>{unreadCount}</b>}
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
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg(
        "Enter your email address first to receive a password reset link.",
      );
      return;
    }
    setLoading(true);
    try {
      await backendResetPassword(email);
      setInfoMsg("Password reset link sent. Check your inbox.");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not send password reset email.",
      );
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
            We sent a confirmation link to <b>{email.trim()}</b>. Confirm your
            email, then sign in to access MSGI One.
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
          <p className="eyebrow">
            {view === "login" ? "MEMBER ACCESS" : "JOIN THE NETWORK"}
          </p>
          <h1>
            {view === "login" ? "Welcome back" : "Create your alumni profile"}
          </h1>
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
              placeholder={
                view === "login" ? "Enter your email" : "name@msgi.edu.in"
              }
              required
            />
          </div>
        </label>
        {view === "register" && (
          <div className="field-row">
            <label>
              <span>Department</span>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
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
              <select
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              >
                {Array.from({ length: 15 }, (_, idx) => String(2028 - idx)).map(
                  (yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ),
                )}
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
          <span>
            {view === "login" ? "New to MSGI One?" : "Already a member?"}
          </span>
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
          <button
            type="button"
            className="google-auth-button"
            onClick={handleGoogleAuth}
          >
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
  openPerson: (userId: string) => void;
  openEvents: () => void;
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [alumni, setAlumni] = useState<DirectoryMember[]>([]);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [rsvpedIds, setRsvpedIds] = useState<Set<string>>(new Set());
  const [rsvpBusy, setRsvpBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      listAlumniDirectory(),
      fetchActiveLocations(),
      getOpportunities(),
      getEvents(true),
      getMyEventRegistrations(),
    ]).then(([dirRes, locRes, oppRes, evRes, regRes]) => {
      if (!active) return;
      if (dirRes.status === "fulfilled") setAlumni(dirRes.value);
      if (locRes.status === "fulfilled") setNearbyCount(locRes.value.length);
      if (oppRes.status === "fulfilled") setOpportunities(oppRes.value);
      if (evRes.status === "fulfilled") setEvents(evRes.value);
      if (regRes.status === "fulfilled") {
        setRsvpedIds(new Set(regRes.value.map((r) => r.event_id)));
      }
    });
    return () => {
      active = false;
    };
  }, []);

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

  const featuredOpportunity = opportunities[0] ?? null;
  const nextEvent = events[0] ?? null;
  const nextEventRsvped = nextEvent ? rsvpedIds.has(nextEvent.id) : false;

  async function toggleNextEventRsvp() {
    if (!nextEvent || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      if (nextEventRsvped) {
        await cancelEventRegistration(nextEvent.id);
        setRsvpedIds((prev) => {
          const next = new Set(prev);
          next.delete(nextEvent.id);
          return next;
        });
      } else {
        await registerForEvent(nextEvent.id);
        setRsvpedIds((prev) => new Set(prev).add(nextEvent.id));
      }
    } catch (err) {
      console.error("Event RSVP failed:", err);
    } finally {
      setRsvpBusy(false);
    }
  }

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
              <strong>{nearbyCount}</strong>
              <small>nearby alumni</small>
            </div>
            <Icon name="chevron" size={16} />
          </button>
          <button onClick={openEvents}>
            <span>
              <Icon name="briefcase" size={18} />
            </span>
            <div>
              <strong>{opportunities.length}</strong>
              <small>live opportunities</small>
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
          {alumni.length > 0 ? (
            <div className="people-scroll">
              {alumni.slice(0, 8).map((person) => (
                <button
                  className="person-mini"
                  key={person.user_id}
                  onClick={() => openPerson(person.user_id)}
                >
                  <div>
                    <Avatar
                      person={{
                        name: person.full_name,
                        role: person.job_title ?? person.role,
                        image: person.avatar_url ?? undefined,
                      }}
                      size="lg"
                    />
                    {person.is_verified && (
                      <span className="verify-dot">
                        <Icon name="check" size={10} />
                      </span>
                    )}
                  </div>
                  <strong>{person.full_name.split(" ")[0]}</strong>
                  <small>{person.company || person.city || "MSGI"}</small>
                </button>
              ))}
            </div>
          ) : (
            <p>Active alumni profiles will appear here as members join.</p>
          )}
        </GlassPanel>

        <GlassPanel className="home-section">
          <SectionHead
            title="For your next move"
            action="View all"
            onClick={openEvents}
          />
          {featuredOpportunity ? (
            <article className="feature-opportunity">
              <div className="feature-top">
                <span className="company-tile">
                  {(
                    featuredOpportunity.company_name ||
                    featuredOpportunity.title
                  )
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <div>
                  <p className="eyebrow">
                    {featuredOpportunity.opportunity_type.toUpperCase()} ·{" "}
                    {(
                      featuredOpportunity.company_name || "MSGI NETWORK"
                    ).toUpperCase()}
                  </p>
                  <h3>{featuredOpportunity.title}</h3>
                  <span>
                    {[
                      featuredOpportunity.location,
                      featuredOpportunity.work_mode,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Open opportunity"}
                  </span>
                </div>
              </div>
              <p>{featuredOpportunity.description}</p>
              <div className="card-actions">
                <small>{opportunities.length} open roles in network</small>
                <button onClick={openEvents}>
                  View role <Icon name="arrow" size={15} />
                </button>
              </div>
            </article>
          ) : (
            <p>No published opportunities yet. Check back soon.</p>
          )}
        </GlassPanel>

        <hr className="home-section-divider" />
        <GlassPanel className="home-section home-coming-up">
          <SectionHead
            title="Coming up"
            action="Calendar"
            onClick={openEvents}
          />
          {nextEvent ? (
            (() => {
              const parts = formatEventDateParts(nextEvent.start_time);
              return (
                <article className="event-card">
                  <div className="date-block">
                    <strong>{parts.day}</strong>
                    <span>{parts.month}</span>
                  </div>
                  <div className="event-info">
                    <p className="eyebrow">
                      {(nextEvent.event_type || "ALUMNI EVENT").toUpperCase()}
                    </p>
                    <h3>{nextEvent.title}</h3>
                    <span>
                      <Icon name="pin" size={14} />{" "}
                      {nextEvent.is_online
                        ? "Online"
                        : nextEvent.venue || "MSGI Campus"}
                      {parts.time ? ` · ${parts.time}` : ""}
                    </span>
                    <div>
                      <b>
                        {nextEventRsvped
                          ? "You’re registered"
                          : "Open for RSVP"}
                      </b>
                      <button
                        className={nextEventRsvped ? "rsvped" : ""}
                        disabled={rsvpBusy}
                        onClick={() => void toggleNextEventRsvp()}
                      >
                        {nextEventRsvped ? "Going" : "RSVP"}
                        {nextEventRsvped && <Icon name="check" size={14} />}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })()
          ) : (
            <p>No upcoming events scheduled yet.</p>
          )}
        </GlassPanel>
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
      setError(
        err instanceof Error ? err.message : "Failed to load admin console.",
      );
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
      setError(
        err instanceof Error ? err.message : "Could not update verification.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="screen">
      <MainSectionHeader
        profile={profile}
        onProfile={onProfile}
        title="Admin console"
      />
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
                      <p>
                        {item.institution_email ||
                          "No institutional email provided"}
                      </p>
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
  openPerson: (userId: string) => void;
  profile: AvatarPerson;
  onProfile: () => void;
}) {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [quickChip, setQuickChip] = useState("All");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await listAlumniDirectory({
          search: query.trim() || undefined,
          city: selectedCity || undefined,
          departmentId: selectedDeptId || undefined,
          graduationYear: selectedYear ? Number(selectedYear) : undefined,
        });
        if (active) setMembers(list);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load alumni directory.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, selectedCity, selectedDeptId, selectedYear]);

  const availableCities = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((m) => m.city?.trim())
            .filter((c): c is string => Boolean(c)),
        ),
      ).sort(),
    [members],
  );

  const filtered = useMemo(
    () =>
      members.filter((m) => {
        if (verifiedOnly && !m.is_verified) return false;
        if (quickChip === "All") return true;
        if (quickChip === "Verified") return m.is_verified;
        const primary = primaryAcademicOf(m.academicRecords);
        const haystack =
          `${m.city ?? ""} ${primary?.department?.name ?? ""} ${m.company ?? ""}`.toLowerCase();
        return haystack.includes(quickChip.toLowerCase());
      }),
    [members, quickChip, verifiedOnly],
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
              placeholder="Name, company, city or role"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
          <div className="chips">
            {["All", "Verified", "Chennai", "Bengaluru", "Computer"].map(
              (c) => (
                <button
                  onClick={() => setQuickChip(c)}
                  className={quickChip === c ? "active" : ""}
                  key={c}
                >
                  {c}
                </button>
              ),
            )}
          </div>
        </GlassPanel>

        {error && (
          <div className="error-banner" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </div>
        )}

        <div className="result-summary">
          <span>
            <b>{filtered.length}</b> alumni found
          </span>
          <span>
            {loading
              ? "Syncing…"
              : verifiedOnly
                ? "Verified only"
                : "Active members"}
          </span>
        </div>

        <div className="directory-list">
          {filtered.map((person) => {
            const academic = primaryAcademicOf(person.academicRecords);
            const deptName = academic?.department?.name || "MSGI Alumni";
            const gradYear = academic?.graduation_year;
            return (
              <article className="alumni-card" key={person.user_id}>
                <button
                  className="alumni-main"
                  onClick={() => openPerson(person.user_id)}
                >
                  <Avatar
                    person={{
                      name: person.full_name,
                      role: person.job_title ?? person.role,
                      image: person.avatar_url ?? undefined,
                    }}
                    size="lg"
                  />
                  <div>
                    <div className="name-line">
                      <h3>{person.full_name}</h3>
                      {person.is_verified && (
                        <span title="Verified">
                          <Icon name="check" size={11} />
                        </span>
                      )}
                    </div>
                    <p>
                      {person.job_title || person.role}
                      {person.company ? (
                        <>
                          {" "}
                          at <b>{person.company}</b>
                        </>
                      ) : null}
                    </p>
                    <small>
                      {deptName}
                      {gradYear ? ` · Class of ${gradYear}` : ""}
                    </small>
                    {person.city && (
                      <small>
                        <Icon name="pin" size={13} />
                        {person.city}
                      </small>
                    )}
                  </div>
                  <Icon name="chevron" className="muted" />
                </button>
                <div className="alumni-actions">
                  <span>
                    {person.is_verified ? "Verified member" : "Active member"}
                  </span>
                  <button onClick={() => openPerson(person.user_id)}>
                    <Icon name="message" size={16} /> View & Message
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && !filtered.length && (
          <div className="empty-state">
            <div>
              <Icon name="search" />
            </div>
            <h3>No alumni found</h3>
            <p>Try a different name, company, department, or city.</p>
            <button
              onClick={() => {
                setQuery("");
                setQuickChip("All");
                setSelectedDeptId("");
                setSelectedCity("");
                setSelectedYear("");
                setVerifiedOnly(false);
              }}
            >
              Clear filters
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
              <button
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              >
                <Icon name="close" />
              </button>
            </div>
            <label>
              Graduation year
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="">All years</option>
                {Array.from({ length: 18 }, (_, idx) => String(2028 - idx)).map(
                  (yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Department
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">Any city</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="check-row">
              <span>
                <Icon name="shield" />
                Verified alumni only
              </span>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
              />
            </label>
            <button
              className="primary-button"
              onClick={() => setFilterOpen(false)}
            >
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
  isVerified,
  locationVisible,
  onToggleLocation,
}: {
  openPerson: (userId: string) => void;
  profile: AvatarPerson;
  onProfile: () => void;
  isVerified: boolean;
  locationVisible: boolean;
  onToggleLocation: (next: boolean) => Promise<void>;
}) {
  const [locations, setLocations] = useState<LiveLocationRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [myCoords, setMyCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      const list = await fetchActiveLocations();
      setLocations(list);
      setSelectedUserId((prev) =>
        prev && list.some((l) => l.user_id === prev)
          ? prev
          : (list[0]?.user_id ?? null),
      );
    } catch (err) {
      setStatusMsg(
        err instanceof Error
          ? err.message
          : "Could not load live alumni locations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocations();
    const unsubscribe = subscribeToLiveLocations(() => {
      void loadLocations();
    });
    return unsubscribe;
  }, [loadLocations]);

  const visibleLocations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter((loc) =>
      `${loc.profile?.full_name ?? ""} ${loc.profile?.city ?? ""} ${loc.profile?.company ?? ""} ${loc.location_label ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [locations, search]);

  const selected =
    visibleLocations.find((l) => l.user_id === selectedUserId) ??
    visibleLocations[0] ??
    null;

  async function handleLocateMe() {
    setLocating(true);
    setStatusMsg(null);
    try {
      const coords = await getDeviceCoordinates();
      setMyCoords(coords);
      if (isVerified) {
        await onToggleLocation(true);
        await loadLocations();
        setStatusMsg(
          "Your live location is updated and visible to verified alumni.",
        );
      } else {
        setStatusMsg(
          "GPS found. Complete alumni verification to broadcast your live pin.",
        );
      }
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : "Unable to read GPS location.",
      );
    } finally {
      setLocating(false);
    }
  }

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
            <button
              className="icon-button"
              aria-label={
                locationVisible ? "Pause location sharing" : "Share my location"
              }
              onClick={() => void onToggleLocation(!locationVisible)}
            >
              <Icon name={locationVisible ? "eye" : "eyeOff"} />
            </button>
          </div>
        </div>
        <div className="map-search search-box">
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a city, company, or alumnus"
          />
        </div>
        <span className="area-label area-one">T. NAGAR</span>
        <span className="area-label area-two">ADYAR</span>
        <span className="area-label area-three">GUINDY</span>

        {visibleLocations.map((loc, i) => {
          const leftPct = 20 + ((i * 23) % 60);
          const topPct = 34 + ((i * 11) % 24);
          return (
            <button
              key={loc.user_id}
              onClick={() => setSelectedUserId(loc.user_id)}
              aria-label={`Show ${loc.profile?.full_name ?? "Alumnus"} on map`}
              aria-pressed={selected?.user_id === loc.user_id}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className={`map-marker ${selected?.user_id === loc.user_id ? "active" : ""}`}
            >
              <Avatar
                person={{
                  name: loc.profile?.full_name || "Alumni",
                  image: loc.profile?.avatar_url ?? undefined,
                }}
                size="sm"
              />
            </button>
          );
        })}

        <button
          className="locate-button"
          onClick={() => void handleLocateMe()}
          disabled={locating}
          aria-label="Update my live location"
        >
          <Icon name="compass" />
        </button>

        <div className="privacy-note">
          <Icon name="shield" size={15} />
          {statusMsg ??
            (isVerified
              ? `${visibleLocations.length} verified alumni sharing live location`
              : "Only verified alumni can view and share live locations")}
        </div>

        {selected ? (
          <article className="map-preview">
            <div className="map-preview__top">
              <Avatar
                person={{
                  name: selected.profile?.full_name || "Verified Alumni",
                  image: selected.profile?.avatar_url ?? undefined,
                }}
                size="lg"
                online
              />
              <div>
                {selected.profile?.is_verified && <VerifyBadge />}
                <h3>{selected.profile?.full_name || "Verified Alumni"}</h3>
                <p>
                  {[selected.profile?.headline, selected.profile?.company]
                    .filter(Boolean)
                    .join(" · ") || "MSGI Alumni"}
                </p>
                <small>
                  <Icon name="pin" size={13} />
                  {selected.location_label ||
                    selected.profile?.city ||
                    "Nearby"}{" "}
                  · {formatDistanceKm(myCoords, selected)}
                </small>
              </div>
            </div>
            <div>
              <button onClick={() => openPerson(selected.user_id)}>
                View profile
              </button>
              <button
                className="navy"
                onClick={() => openPerson(selected.user_id)}
              >
                <Icon name="message" size={16} />
                Message
              </button>
            </div>
          </article>
        ) : (
          <article className="map-preview">
            <div className="map-preview__top">
              <div>
                <h3>
                  {loading ? "Loading live map…" : "No active alumni pins yet"}
                </h3>
                <p>
                  {isVerified
                    ? "Tap the compass button to share your live location."
                    : "Verify your alumni profile to view and join the live proximity map."}
                </p>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function InboxScreen({
  openChat,
  profile,
  onProfile,
  onUnreadChange,
}: {
  openChat: (
    conversationId: string,
    partner?: ChatMemberProfile | null,
    title?: string | null,
  ) => void;
  profile: AvatarPerson;
  onProfile: () => void;
  onUnreadChange: (count: number) => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="screen flex items-center justify-center" role="status">
          Loading inbox…
        </div>
      }
    >
      <MessagingInbox
        openChat={openChat}
        onUnreadChange={onUnreadChange}
        renderHeader={(_compose, search) => (
          <MainSectionHeader
            profile={profile}
            onProfile={onProfile}
            title="Inbox"
            action={
              <button
                className="icon-button"
                aria-label="Search conversations"
                onClick={search}
              >
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
  conversationId,
  partner,
  title,
  onBack,
  viewProfile,
}: {
  conversationId: string;
  partner?: ChatMemberProfile | null;
  title?: string | null;
  onBack: () => void;
  viewProfile: (userId: string) => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="screen flex items-center justify-center" role="status">
          Loading conversation…
        </div>
      }
    >
      <ConversationScreen
        key={conversationId}
        conversationId={conversationId}
        partner={partner}
        title={title}
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
  locationBusy,
  locationError,
  onToggleLocation,
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
  locationBusy: boolean;
  locationError: string | null;
  onToggleLocation: (visible: boolean) => Promise<void>;
  openSettings: (route: SettingsRoute) => void;
  edit: () => void;
  isAdmin: boolean;
  openAdmin: () => void;
}) {
  const person = {
    name: account.fullName,
    role: account.role,
    image: account.avatar,
  };
  const [verification, setVerification] = useState<AlumniVerification | null>(
    null,
  );
  const [instEmail, setInstEmail] = useState(account.email);
  const [gradYear, setGradYear] = useState(account.graduationYear || "2024");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingVerif, setSubmittingVerif] = useState(false);
  const [verifMsg, setVerifMsg] = useState<string | null>(null);
  const [verifErr, setVerifErr] = useState<string | null>(null);

  useEffect(() => {
    if (account.verified) return;
    getMyVerificationStatus()
      .then(setVerification)
      .catch(() => {});
  }, [account.verified]);

  async function handleVerificationSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmittingVerif(true);
    setVerifErr(null);
    setVerifMsg(null);
    try {
      let proofPath: string | undefined;
      if (proofFile) {
        proofPath = await uploadVerificationProof(proofFile);
      }
      const created = await submitAlumniVerification({
        institutionEmail: instEmail,
        graduationYear: Number(gradYear) || undefined,
        proofPath,
      });
      setVerification(created);
      setProofFile(null);
      setVerifMsg("Verification request submitted for admin review.");
    } catch (err) {
      setVerifErr(
        err instanceof Error
          ? err.message
          : "Could not submit verification request.",
      );
    } finally {
      setSubmittingVerif(false);
    }
  }

  return (
    <div className="screen profile-screen">
      <div className="profile-hero">
        <BrandBar
          action={
            <button
              className="icon-button"
              onClick={edit}
              aria-label="Edit profile details"
            >
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
              {account.graduationYear
                ? ` · Class of ${account.graduationYear}`
                : ""}
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
              if (linkedinUrl)
                window.open(linkedinUrl, "_blank", "noopener,noreferrer");
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
              <b>
                {account.verified ? "Verified alumni" : "Pending verification"}
              </b>
            </span>
          </div>
        </GlassPanel>

        {!account.verified && (
          <GlassPanel className="profile-section">
            <p className="eyebrow">ALUMNI VERIFICATION</p>
            <h2>Verify your MSGI membership</h2>
            {verifMsg && (
              <div className="success-banner" role="status">
                <Icon name="check" size={16} />
                {verifMsg}
              </div>
            )}
            {verifErr && (
              <div className="error-banner" role="alert">
                <Icon name="alert" size={16} />
                {verifErr}
              </div>
            )}
            {verification?.status === "pending" ? (
              <p>
                Your verification request (Class of{" "}
                {verification.graduation_year ?? "—"}) is currently{" "}
                <b>pending admin review</b>.
              </p>
            ) : (
              <form className="edit-form" onSubmit={handleVerificationSubmit}>
                <label className="field">
                  <span>Institutional email</span>
                  <input
                    type="email"
                    value={instEmail}
                    onChange={(e) => setInstEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Graduation year</span>
                  <input
                    type="number"
                    min={1990}
                    max={2035}
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Alumni ID / Degree proof (optional image or PDF)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button className="primary-button" disabled={submittingVerif}>
                  {submittingVerif ? "Submitting…" : "Submit for verification"}
                </button>
              </form>
            )}
          </GlassPanel>
        )}

        <section className="privacy-card">
          <div className="privacy-card__icon">
            <Icon name="shield" />
          </div>
          <div>
            <p className="eyebrow">PRIVACY CONTROL</p>
            <h3>Location visibility</h3>
            <p>
              Show your approximate location on the Live Alumni Map to verified
              members. Turn off anytime.
            </p>
            {locationError && (
              <small style={{ color: "#dc2626" }}>{locationError}</small>
            )}
          </div>
          <button
            disabled={locationBusy}
            onClick={() => void onToggleLocation(!locationVisible)}
            className={`toggle ${locationVisible ? "on" : ""}`}
            aria-label="Toggle location visibility"
            role="switch"
            aria-checked={locationVisible}
          >
            <span />
          </button>
          <div className="privacy-status">
            <Icon name={locationVisible ? "check" : "lock"} size={14} />
            {locationBusy
              ? "Updating GPS…"
              : locationVisible
                ? "Visible to verified alumni"
                : "Location hidden"}
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
  userId,
  currentUserId,
  onBack,
  onMessageStarted,
}: {
  userId: string;
  currentUserId?: string;
  onBack: () => void;
  onMessageStarted: (
    conversationId: string,
    partner: ChatMemberProfile,
  ) => void;
}) {
  const [record, setRecord] = useState<{
    profile: Profile;
    academicRecords: AcademicRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProfileById(userId)
      .then((res) => {
        if (active) setRecord(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="screen person-profile">
        <TopBar title="Alumni profile" onBack={onBack} />
        <div className="content">
          <p>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="screen person-profile">
        <TopBar title="Alumni profile" onBack={onBack} />
        <div className="content">
          <div className="empty-state">
            <h3>Profile unavailable</h3>
            <p>This member profile could not be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  const p = record.profile;
  const academic = primaryAcademicOf(record.academicRecords);
  const sharedLinks = getSharedSocialLinks({
    ...(p.linkedin_url ? { linkedin: p.linkedin_url } : {}),
    ...(p.website_url ? { website: p.website_url } : {}),
  });
  const isSelf = currentUserId === p.user_id;

  async function handleConnect() {
    if (isSelf || connected || actionBusy) return;
    setActionBusy(true);
    setActionNote(null);
    try {
      await createMentorshipRequest(
        p.user_id,
        "Hi! I’d love to connect on MSGI One.",
      );
      setConnected(true);
      setActionNote("Connection / mentorship request sent.");
    } catch (err) {
      setActionNote(
        err instanceof Error ? err.message : "Could not send request.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleMessage() {
    if (isSelf || actionBusy) return;
    setActionBusy(true);
    setActionNote(null);
    try {
      const conversationId = await getOrCreateDirectConversation(p.user_id);
      onMessageStarted(conversationId, {
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        headline: p.headline,
        is_verified: p.is_verified,
      });
    } catch (err) {
      setActionNote(
        err instanceof Error ? err.message : "Could not start conversation.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="screen person-profile">
      <TopBar title="Alumni profile" onBack={onBack} />
      <div className="person-cover">
        <div className="person-card glass-panel">
          <Avatar
            person={{
              name: p.full_name,
              role: p.job_title ?? p.role,
              image: p.avatar_url ?? undefined,
            }}
            size="xl"
          />
          {p.is_verified && <VerifyBadge />}
          <h1>{p.full_name}</h1>
          <p>
            {p.job_title || p.role}
            {p.company ? ` at ${p.company}` : ""}
          </p>
          <span>
            {academic?.department?.name || "MSGI Alumni"}
            {academic?.graduation_year
              ? ` · Class of ${academic.graduation_year}`
              : ""}
          </span>
          {p.city && (
            <small>
              <Icon name="pin" size={13} />
              {p.city}
              {p.country ? `, ${p.country}` : ""}
            </small>
          )}
          {!isSelf && (
            <div>
              <button
                className={connected ? "connected" : ""}
                disabled={actionBusy}
                onClick={() => void handleConnect()}
              >
                {connected ? (
                  <>
                    <Icon name="check" size={16} />
                    Requested
                  </>
                ) : (
                  "Connect"
                )}
              </button>
              <button
                disabled={actionBusy}
                onClick={() => void handleMessage()}
              >
                <Icon name="message" size={16} />
                Message
              </button>
            </div>
          )}
          {actionNote && <small>{actionNote}</small>}
        </div>
      </div>
      <div className="content person-details">
        <section>
          <p className="eyebrow">ABOUT</p>
          <h2>{p.headline || "MSGI Community Member"}</h2>
          {p.bio && <p>{p.bio}</p>}
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
                  aria-label={`Open ${p.full_name}'s ${link.label} in a new tab`}
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
        {p.company && (
          <section>
            <p className="eyebrow">EXPERIENCE</p>
            <div className="experience">
              <span>{p.company.charAt(0).toUpperCase()}</span>
              <div>
                <h3>{p.job_title || p.role}</h3>
                <p>{p.company}</p>
                {p.city && <small>{p.city}</small>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function EventsScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"Events" | "Opportunities">("Events");
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getEvents(), getOpportunities(), getMyEventRegistrations()])
      .then(([evList, oppList, myRegs]) => {
        if (!active) return;
        setEvents(evList);
        setOpportunities(oppList);
        setRegisteredIds(new Set(myRegs.map((r) => r.event_id)));
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Failed to load listings.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggleRsvp(eventId: string) {
    setBusyId(eventId);
    setError(null);
    try {
      if (registeredIds.has(eventId)) {
        await cancelEventRegistration(eventId);
        setRegisteredIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      } else {
        await registerForEvent(eventId);
        setRegisteredIds((prev) => new Set(prev).add(eventId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update RSVP.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApply(opp: Opportunity) {
    if (appliedIds.has(opp.id)) return;
    setBusyId(opp.id);
    setError(null);
    try {
      await applyToOpportunity({ opportunityId: opp.id });
      setAppliedIds((prev) => new Set(prev).add(opp.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit application.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="screen">
      <TopBar title="Events & opportunities" onBack={onBack} />
      <div className="content events-content">
        <div className="inbox-tabs">
          <button
            className={tab === "Events" ? "active" : ""}
            onClick={() => setTab("Events")}
          >
            Events ({events.length})
          </button>
          <button
            className={tab === "Opportunities" ? "active" : ""}
            onClick={() => setTab("Opportunities")}
          >
            Opportunities ({opportunities.length})
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </div>
        )}

        <div className="editorial-head">
          <p className="eyebrow">
            {tab === "Events"
              ? "MSGI ALUMNI CALENDAR"
              : "CURATED FOR YOUR PROFILE"}
          </p>
          <h1>
            {tab === "Events"
              ? "Meet, learn and reconnect."
              : "Your next move starts here."}
          </h1>
        </div>

        {loading ? (
          <p>Loading {tab.toLowerCase()}…</p>
        ) : tab === "Events" ? (
          events.length > 0 ? (
            <div className="event-list">
              {events.map((ev, index) => {
                const parts = formatEventDateParts(ev.start_time);
                const isGoing = registeredIds.has(ev.id);
                if (index === 0) {
                  return (
                    <article className="large-event" key={ev.id}>
                      <div className="event-visual">
                        <span>
                          {parts.day}
                          <br />
                          <small>{parts.month}</small>
                        </span>
                        <b>{ev.is_online ? "ONLINE" : "FEATURED"}</b>
                      </div>
                      <div>
                        <p className="eyebrow">
                          {(ev.event_type || "ALUMNI EVENT").toUpperCase()}
                        </p>
                        <h2>{ev.title}</h2>
                        {ev.description && <p>{ev.description}</p>}
                        <span>
                          <Icon name="pin" size={14} />
                          {ev.is_online ? "Online" : ev.venue || "MSGI Campus"}
                          {parts.time ? ` · ${parts.time}` : ""}
                        </span>
                        <button
                          disabled={busyId === ev.id}
                          onClick={() => void toggleRsvp(ev.id)}
                        >
                          {isGoing ? "Cancel RSVP" : "Reserve your seat"}{" "}
                          <Icon name={isGoing ? "check" : "arrow"} size={15} />
                        </button>
                      </div>
                    </article>
                  );
                }
                return (
                  <article className="simple-event" key={ev.id}>
                    <div className="date-block">
                      <strong>{parts.day}</strong>
                      <span>{parts.month}</span>
                    </div>
                    <div>
                      <p className="eyebrow">
                        {(ev.event_type || "EVENT").toUpperCase()}
                      </p>
                      <h3>{ev.title}</h3>
                      <span>
                        {ev.is_online ? "Online" : ev.venue || "TBA"}
                        {parts.time ? ` · ${parts.time}` : ""}
                      </span>
                    </div>
                    <button
                      disabled={busyId === ev.id}
                      onClick={() => void toggleRsvp(ev.id)}
                    >
                      <Icon name={isGoing ? "check" : "chevron"} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No published events yet</h3>
              <p>Upcoming alumni meetups and workshops will appear here.</p>
            </div>
          )
        ) : opportunities.length > 0 ? (
          <div className="opportunity-list">
            {opportunities.map((opp) => {
              const applied = appliedIds.has(opp.id);
              return (
                <article key={opp.id}>
                  <div className="opportunity-head">
                    <span className="company-tile">
                      {(opp.company_name || opp.title).charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <small>
                        {(opp.company_name || "MSGI NETWORK").toUpperCase()}
                      </small>
                      <h3>{opp.title}</h3>
                      <p>
                        {[opp.location, opp.work_mode]
                          .filter(Boolean)
                          .join(" · ") || opp.opportunity_type}
                      </p>
                    </div>
                    <VerifyBadge label={opp.opportunity_type} />
                  </div>
                  <p>{opp.description}</p>
                  <button
                    disabled={busyId === opp.id}
                    onClick={() => void handleApply(opp)}
                    className={applied ? "success-button" : ""}
                  >
                    {applied ? (
                      <>
                        <Icon name="check" />
                        Application submitted
                      </>
                    ) : (
                      <>
                        Apply now <Icon name="arrow" />
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No opportunities posted yet</h3>
            <p>Alumni job referrals and internships will show up here.</p>
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
      onSaveSocialLinks({
        alumniId,
        links,
        updatedAt: new Date().toISOString(),
      });
      setSocialDraft(toSocialLinksDraft(links));
      await onSavedProfile();
      setSaved(true);
      return true;
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save profile.",
      );
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
          <button
            className="save-link"
            onClick={() => void save()}
            disabled={saving}
          >
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
            person={{
              name: account.fullName,
              role: account.role,
              image: account.avatar,
            }}
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
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Job title</span>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Company</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
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
            Add only the profiles you want verified alumni to see. Empty fields
            stay hidden.
          </p>
          {socialPlatforms.map((platform) => {
            const error = socialErrors[platform.key];
            const inputId = `social-${platform.key}`;
            return (
              <div className="field social-field" key={platform.key}>
                <label htmlFor={inputId}>{platform.label}</label>
                <div
                  className={`input-wrap ${error ? "input-wrap--error" : ""}`}
                >
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
                    onChange={(event) =>
                      updateSocialLink(platform.key, event.target.value)
                    }
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

  const [settings, setSettings] = useState<UserSettings>(() =>
    loadSettings(fallbackAccount),
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [settingsStack, setSettingsStack] = useState<SettingsRoute[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner?: ChatMemberProfile | null;
    title?: string | null;
  } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [preferAdminTab, setPreferAdminTab] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<number | null>(() =>
    typeof window === "undefined"
      ? null
      : parseSharedProfileId(window.location.search),
  );
  const [publicViewDismissed, setPublicViewDismissed] = useState(false);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    prefersDark() ? "dark" : "light",
  );
  const [socialLinksByAlumni, setSocialLinksByAlumni] = useState<
    Record<AlumniId, SocialLinks>
  >({});

  // Sync Supabase profile + private details + academic records into UI settings.account
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const primaryAcademic = primaryAcademicOf(academicRecords);
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
            email:
              user.email ?? details?.personal_email ?? current.account.email,
            phone: details?.phone ?? "",
            role: resolvedRole,
            company: profile?.company ?? "",
            city: profile?.city ?? "",
            department:
              primaryAcademic?.department?.name ?? current.account.department,
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
  const t = useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
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
    const onChange = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? "dark" : "light");
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
            ? (next as (value: UserSettings[K]) => UserSettings[K])(
                current[section],
              )
            : next,
      })),
    [],
  );

  const handleToggleLocation = useCallback(
    async (nextVisible: boolean) => {
      setLocationBusy(true);
      setLocationError(null);
      try {
        await setLocationSharing(nextVisible);
        update("privacy", (current) => ({
          ...current,
          locationVisible: nextVisible,
        }));
      } catch (err) {
        setLocationError(
          err instanceof Error
            ? err.message
            : "Could not update live location (verified alumni only).",
        );
      } finally {
        setLocationBusy(false);
      }
    },
    [update],
  );

  const saveSocialLinks = ({ alumniId, links }: AlumniSocialLinksRecord) =>
    setSocialLinksByAlumni((current) => ({ ...current, [alumniId]: links }));

  const openPerson = (userId: string) => {
    setSelectedPersonId(userId);
    setOverlay("person");
  };
  const openChat = (
    conversationId: string,
    partner?: ChatMemberProfile | null,
    title?: string | null,
  ) => {
    setActiveChat({ conversationId, partner, title });
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
  const closePreview = () =>
    setOverlay(settingsStack.length ? "settings" : "none");
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
        sessions: current.security.sessions.filter(
          (session) => !session.current,
        ),
      },
    }));
    setActiveChat(null);
    setUnreadCount(0);
    setScreen("home");
    setOverlay("none");
    setSettingsStack([]);
    setAuthNotice(notice ?? null);
  };

  const deleteAccount = () => {
    clearStoredSettings(fallbackAccount.id);
    setSocialLinksByAlumni(
      ({ [fallbackAccount.id]: _removed, ...rest }) => rest,
    );
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
        : "missing";

  useEffect(() => {
    if (!isAuthenticated || pendingProfileId === null) return;
    if (sharedTarget === "self") setOverlay("preview");
    else setOverlay("unavailable");
    setSettingsStack([]);
    setPendingProfileId(null);
    removeSharedProfileParam();
  }, [isAuthenticated, pendingProfileId, sharedTarget]);

  if (authLoading && !isAuthenticated) {
    return (
      <div className="app-stage">
        <div className="phone-shell">
          <div
            className="screen flex items-center justify-center"
            role="status"
          >
            Restoring session…
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const showPublicProfile =
      sharedTarget === "self" &&
      privacy.profileVisibility === "public" &&
      !publicViewDismissed;
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
            <Auth
              onSignedIn={handleSignedIn}
              notice={linkNotice ?? authNotice}
            />
          )}
        </div>
        <div className="desktop-note">
          <Logo />
          <h1>A private network for a lifetime of opportunity.</h1>
          <p>
            MSGI One connects verified alumni through meaningful introductions,
            trusted career opportunities and shared institutional pride.
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
          <div
            className="screen flex items-center justify-center"
            role="status"
          >
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
          reportablePeople={[]}
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
  else if (overlay === "person" && selectedPersonId)
    content = (
      <PersonProfile
        userId={selectedPersonId}
        currentUserId={user?.id}
        onBack={() => setOverlay("none")}
        onMessageStarted={(conversationId, partner) =>
          openChat(conversationId, partner)
        }
      />
    );
  else if (overlay === "chat" && activeChat)
    content = (
      <ChatScreen
        conversationId={activeChat.conversationId}
        partner={activeChat.partner}
        title={activeChat.title}
        onBack={() => setOverlay("none")}
        viewProfile={(uid) => openPerson(uid)}
      />
    );
  else if (overlay === "events")
    content = <EventsScreen onBack={() => setOverlay("none")} />;
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
        isVerified={Boolean(profile?.is_verified)}
        locationVisible={privacy.locationVisible}
        onToggleLocation={handleToggleLocation}
      />
    );
  else if (screen === "feed")
    content = (
      <CommunityFeed
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
        onOpenPerson={openPerson}
        onOpenEvents={() => setOverlay("events")}
      />
    );
  else if (screen === "inbox")
    content = (
      <InboxScreen
        openChat={openChat}
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
        onUnreadChange={setUnreadCount}
      />
    );
  else if (screen === "admin" && isAdmin)
    content = (
      <AdminScreen
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
      />
    );
  else
    content = (
      <ProfileScreen
        account={settings.account}
        headline={ownHeadline}
        bio={profile?.bio ?? ""}
        linkedinUrl={profile?.linkedin_url}
        locationVisible={privacy.locationVisible}
        locationBusy={locationBusy}
        locationError={locationError}
        onToggleLocation={handleToggleLocation}
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
          <BottomNav
            screen={screen}
            setScreen={setScreen}
            t={t}
            isAdmin={isAdmin}
            unreadCount={unreadCount}
          />
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
