import {
  ReactNode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import feedNavLogo from "./assets/msgi-feed-nav.png";
import { AuthFlow } from "./auth/AuthFlow";
import { requireVerified, type MembershipSession } from "./auth/model";
import { createMessagingStore, type MessagingStore } from "./messaging/model";
import { CommunityFeed, feedPostExists } from "./feed/CommunityFeed";
import { ForgotPassword } from "./network/ForgotPassword";
import { SupportPage } from "./network/SupportPage";
import { NotificationsPage } from "./network/NotificationsPage";
import { NotificationNavigation } from "./network/navigation";
import { parseResetLink, validateNotifications } from "./network/model";
import type { AppServices, NotificationTarget } from "./network/services";
import { useAnimatedDismiss } from "./ui/motion";
import { LocationFilter } from "./directory/LocationFilter";
import { matchesLocation, type LocationSelection } from "./directory/locations";
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

type Screen = "home" | "directory" | "map" | "feed" | "inbox" | "profile";
type Overlay =
  | "none"
  | "person"
  | "chat"
  | "events"
  | "edit"
  | "settings"
  | "notifications"
  | "preview"
  | "unavailable";

/** Signed-out appearance fallback only; never authorizes access to the application. */
const signedInAccount = createSampleAccount();
const ownHeadline = "Building thoughtful tools for growing teams.";

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

const directoryInstitutions = [
  ["MSEC", "Meenakshi Sundararajan Engineering College (MSEC)"],
  ["MSSM", "Meenakshi Sundararajan School of Management (MSSM)"],
  ["MCW", "Meenakshi College for Women (MCW)"],
] as const;
const graduationYears = Array.from(
  { length: new Date().getFullYear() - 2000 + 1 },
  (_, index) => String(2000 + index),
);

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
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  t: Translator;
}) {
  const items: { key: Screen; icon: IconName; label: string }[] = [
    { key: "home", icon: "home", label: t("nav.home") },
    { key: "map", icon: "map", label: t("nav.map") },
    { key: "feed", icon: "feed", label: "Feed" },
    { key: "inbox", icon: "message", label: t("nav.inbox") },
    { key: "directory", icon: "users", label: t("nav.directory") },
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
  return (
    <div className="screen">
      <div className="home-hero curved-header">
        <MainHeader person={profile} onProfile={onProfile} />
        <div className="welcome">
          <p>THURSDAY, 14 MARCH</p>
          <h1>
            Good morning, <em>Aarav.</em>
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
  const filterPanel = useRef<HTMLElement>(null);
  const closeFilter = useAnimatedDismiss(filterPanel, () => setFilterOpen(false));
  const [filter, setFilter] = useState("All");
  const [graduationYear, setGraduationYear] = useState("");
  const [institution, setInstitution] = useState("");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          `${p.name} ${p.company} ${p.city} ${p.dept}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === "All" || p.city === filter || p.dept.includes(filter)) &&
          (!graduationYear || p.year === graduationYear) &&
          matchesLocation(p.city, location) &&
          // Do not infer an institution from a member's department.
          (!institution || ("institution" in p && p.institution === institution)),
      ),
    [query, filter, graduationYear, institution, location],
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
            <p>Try a different search, graduation year or institution.</p>
            <button
              onClick={() => {
                setQuery("");
                setFilter("All");
                setGraduationYear("");
                setInstitution("");
                setLocation(null);
              }}
            >
              Clear search and filters
            </button>
          </div>
        )}
      </div>
      {filterOpen && (
        <div className="sheet-backdrop" onClick={closeFilter}>
          <section
            ref={filterPanel}
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
              <button onClick={closeFilter} aria-label="Close filters">
                <Icon name="close" />
              </button>
            </div>
            <label>
              Graduation year
              <select
                value={graduationYear}
                onChange={(event) => setGraduationYear(event.target.value)}
              >
                <option value="">All graduation years</option>
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Institutions
              <select value={institution} onChange={(event) => setInstitution(event.target.value)}>
                <option value="">All institutions</option>
                {directoryInstitutions.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select>
                <option>All departments</option>
                <option>Computer Science</option>
                <option>Information Technology</option>
              </select>
            </label>
            <LocationFilter value={location} onChange={setLocation} />
            <label className="check-row">
              <span>
                <Icon name="shield" />
                Verified alumni only
              </span>
              <input type="checkbox" defaultChecked />
            </label>
            <button className="primary-button" onClick={closeFilter}>
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
  locationVisible,
  setLocationVisible,
  openSettings,
  edit,
}: {
  account: UserSettings["account"];
  locationVisible: boolean;
  setLocationVisible: (visible: boolean) => void;
  openSettings: (route: SettingsRoute) => void;
  edit: () => void;
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
              {account.role} at {account.company}
            </p>
            <span>
              {account.department} · Class of {account.graduationYear}
            </span>
          </div>
        </div>
      </div>
      <div className="content profile-content">
        <GlassPanel className="profile-section">
          <p className="eyebrow">PROFESSIONAL IDENTITY</p>
          <h2>{ownHeadline}</h2>
          <div className="detail-grid">
            <span>
              <small>Current role</small>
              <b>{account.role}</b>
            </span>
            <span>
              <small>Company</small>
              <b>{account.company}</b>
            </span>
            <span>
              <small>Location</small>
              <b>{account.city}, India</b>
            </span>
            <span>
              <small>Experience</small>
              <b>5 years</b>
            </span>
          </div>
        </GlassPanel>
        <GlassPanel className="profile-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">EXPERTISE</p>
              <h2>Skills & interests</h2>
            </div>
          </div>
          <div className="skill-list">
            <span>Product strategy</span>
            <span>Design systems</span>
            <span>Mentorship</span>
            <span>B2B SaaS</span>
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

function EventsScreen({
  onBack, destination,
}: {
  onBack: () => void;
  destination?: { type: "event" | "opportunity"; id: string } | null;
}) {
  const [tab, setTab] = useState(destination?.type === "opportunity" ? "Opportunities" : "Events");
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (!destination) return;
    const item = document.getElementById(`network-${destination.id}`);
    item?.scrollIntoView({ block: "center" });
    item?.focus({ preventScroll: true });
  }, [destination]);
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
            <article className="large-event" id="network-leaders-table" tabIndex={-1}>
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
            <article className="simple-event" id="network-career-storytelling" tabIndex={-1}>
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
            <article id="network-zoho-senior-engineer" tabIndex={-1}>
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
            <article id="network-freshworks-design-lead" tabIndex={-1}>
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
  socialLinks,
  onSaveSocialLinks,
  onBack,
}: {
  alumniId: AlumniId;
  account: UserSettings["account"];
  socialLinks?: SocialLinks;
  onSaveSocialLinks: (record: AlumniSocialLinksRecord) => void;
  onBack: () => void;
}) {
  const [saved, setSaved] = useState(false);
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
  const save = () => {
    const { links, errors } = validateSocialLinks(socialDraft);
    setSocialErrors(errors);
    if (Object.keys(errors).length) {
      setSaved(false);
      return false;
    }
    onSaveSocialLinks({ alumniId, links, updatedAt: new Date().toISOString() });
    setSocialDraft(toSocialLinksDraft(links));
    setSaved(true);
    return true;
  };
  return (
    <div className="screen">
      <TopBar
        title="Edit profile"
        onBack={onBack}
        action={
          <button className="save-link" onClick={save}>
            Save
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
        {hasSocialErrors && (
          <div className="error-banner" role="alert">
            <Icon name="close" />
            Check the highlighted social links before saving.
          </div>
        )}
        <div className="edit-photo glass-panel">
          <Avatar
            person={{ name: account.fullName, role: account.role, image: account.avatar }}
            size="xl"
          />
          <button>
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
            <input defaultValue="Senior Product Designer at Freshworks" />
          </label>
          <label className="field">
            <span>Company</span>
            <input defaultValue="Freshworks" />
          </label>
          <label className="field">
            <span>Location</span>
            <input defaultValue="Chennai, India" />
          </label>
          <label className="field">
            <span>About</span>
            <textarea defaultValue="Building thoughtful tools for growing teams." />
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
            onClick={() => {
              if (save()) window.setTimeout(onBack, 700);
            }}
          >
            Save changes
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

const disconnectedServices: AppServices = {};

export default function App({ services = disconnectedServices }: { services?: AppServices }) {
  const [messaging] = useState(() => createMessagingStore(conversations));
  useEffect(() => () => messaging.dispose(), [messaging]);
  const [account, setAccount] = useState(signedInAccount);
  const currentAlumniId: AlumniId = account.id;
  const [signedIn, setSignedIn] = useState(false);
  const [authEntryView, setAuthEntryView] = useState<"register" | "login">("register");
  // Loaded before sign-in so this device's appearance applies to the sign-in screen too.
  const [settings, setSettings] = useState<UserSettings>(() => {
    return loadSettings(account);
  });
  const [screen, setScreen] = useState<Screen>("home");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [settingsStack, setSettingsStack] = useState<SettingsRoute[]>([]);
  const [selectedPerson, setSelectedPerson] = useState(1);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState(() => parseResetLink(window.location.hash));
  const [accessPage, setAccessPage] = useState<"login" | "forgot" | "support">(
    () => parseResetLink(window.location.hash).requested ? "forgot" : "login",
  );
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [feedTarget, setFeedTarget] = useState<string | null>(null);
  const [feedCreationOpen, setFeedCreationOpen] = useState(false);
  const [eventTarget, setEventTarget] = useState<{ type: "event" | "opportunity"; id: string } | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<number | null>(() =>
    typeof window === "undefined" ? null : parseSharedProfileId(window.location.search),
  );
  const [publicViewDismissed, setPublicViewDismissed] = useState(false);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    prefersDark() ? "dark" : "light",
  );
  // Keyed by alumni account so a public profile can only read its owner's links.
  const [socialLinksByAlumni, setSocialLinksByAlumni] = useState<Record<AlumniId, SocialLinks>>({});

  const t = useMemo(() => createTranslator(settings.language), [settings.language]);
  const locale = localeFor(settings.language);
  const { appearance, language, privacy } = settings;
  const resolvedTheme = resolveTheme(appearance.theme, systemTheme === "dark");
  const mainProfile: AvatarPerson = {
    name: settings.account.fullName,
    role: settings.account.role,
    image: settings.account.avatar,
  };
  useEffect(() => {
    const onHashChange = () => {
      const link = parseResetLink(window.location.hash);
      setResetLink(link);
      if (link.requested) setAccessPage("forgot");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    if (!signedIn || !services.notifications) return;
    const controller = new AbortController();
    void services.notifications.list(controller.signal).then(
      (items) => {
        if (controller.signal.aborted) return;
        try {
          setNotificationUnread(validateNotifications(items).filter((item) => !item.read).length);
        } catch {
          setNotificationUnread(0);
        }
      },
      () => { if (!controller.signal.aborted) setNotificationUnread(0); },
    );
    return () => controller.abort();
  }, [signedIn, services.notifications]);
  const returnToLogin = () => {
    setAuthEntryView("login");
    setAccessPage("login");
    setResetLink({ requested: false, token: null });
    if (parseResetLink(window.location.hash).requested)
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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

  // Persist only for the signed-in member; signing out or deleting must not rewrite storage.
  useEffect(() => {
    if (signedIn) saveSettings(settings);
  }, [settings, signedIn]);

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
  const openNotificationTarget = (target: NotificationTarget): string | null => {
    if (target.type === "profile") {
      if (target.id === account.id) setOverlay("preview");
      else if (people.some((person) => person.id === target.id)) openPerson(target.id);
      else return "This profile is no longer available.";
    } else if (target.type === "message") {
      if (!conversations.some((conversation) => conversation.id === target.id))
        return "This conversation is no longer available.";
      openChat(target.id);
    } else if (target.type === "feed") {
      if (!feedPostExists(target.id)) return "This post is no longer available.";
      setFeedTarget(target.id);
      setScreen("feed");
      setOverlay("none");
    } else {
      const ids = target.type === "event"
        ? ["leaders-table", "career-storytelling"]
        : ["zoho-senior-engineer", "freshworks-design-lead"];
      if (!ids.includes(target.id)) return "This item is no longer available.";
      setEventTarget({ type: target.type, id: target.id });
      setOverlay("events");
    }
    return null;
  };
  const settingsBack = () => {
    // Leaving the first Settings screen returns to wherever Settings was opened from.
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

  const openWebsitePreview = () => {
    if (services.membershipAuth) return;
    setAccount(signedInAccount);
    setSettings(loadSettings(signedInAccount));
    setAuthNotice(null);
    setPublicViewDismissed(false);
    setScreen("home");
    setOverlay("none");
    setSignedIn(true);
    returnToLogin();
  };
  const signIn = (result: Extract<MembershipSession, { status: "verified" }>) => {
    const session = requireVerified(result);
    setAccount(session.account);
    setSettings(withCurrentSession(loadSettings(session.account), true));
    setAuthNotice(null);
    setPublicViewDismissed(false);
    setScreen("home");
    setOverlay("none");
    setSignedIn(true);
    returnToLogin();
  };
  const logout = async (notice?: string) => {
    if (services.membershipAuth) await services.membershipAuth.signOut(new AbortController().signal);
    setSettings((current) => ({
      ...current,
      security: {
        ...current.security,
        sessions: current.security.sessions.filter((session) => !session.current),
      },
    }));
    setSignedIn(false);
    setScreen("home");
    setOverlay("none");
    setSettingsStack([]);
    setAuthNotice(notice ?? null);
    returnToLogin();
    setNotificationUnread(0);
  };
  const deleteAccount = () => {
    clearStoredSettings(account.id);
    setSocialLinksByAlumni(({ [account.id]: _removed, ...rest }) => rest);
    setSettings(createDefaultSettings(account));
    logout(t("delete.notice"));
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
      : pendingProfileId === account.id
        ? "self"
        : people.some((person) => person.id === pendingProfileId)
          ? "person"
          : "missing";

  // Shared links open once the visitor is signed in, then the URL is cleaned up.
  useEffect(() => {
    if (!signedIn || pendingProfileId === null) return;
    if (sharedTarget === "self") setOverlay("preview");
    else if (sharedTarget === "person") {
      setSelectedPerson(pendingProfileId);
      setOverlay("person");
    } else setOverlay("unavailable");
    setSettingsStack([]);
    setPendingProfileId(null);
    removeSharedProfileParam();
  }, [signedIn, pendingProfileId, sharedTarget]);

  if (!signedIn || resetLink.requested) {
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
          {accessPage === "forgot" ? (
            <ForgotPassword key={resetLink.requested ? resetLink.token ?? "invalid-reset" : "request-reset"}
              service={services.auth} resetRequested={resetLink.requested}
              token={resetLink.token} onLogin={() => {
                if (signedIn) logout();
                else returnToLogin();
              }} />
          ) : accessPage === "support" ? (
            <SupportPage service={services.support} onBack={returnToLogin} onReturn={returnToLogin} />
          ) : showPublicProfile ? (
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
            <AuthFlow service={services.membershipAuth} initialView={authEntryView} onVerified={signIn} notice={linkNotice ?? authNotice}
              onPreview={services.membershipAuth ? undefined : openWebsitePreview}
              onForgotPassword={() => setAccessPage("forgot")}
              onSupport={() => setAccessPage("support")} />
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
  if (overlay === "notifications")
    content = (
      <NotificationsPage service={services.notifications}
        onBack={() => setOverlay("none")} onNavigate={openNotificationTarget}
        onUnreadChange={setNotificationUnread} />
    );
  else if (overlay === "settings" && settingsStack.length)
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
          supportService={services.support}
          returnToApp={() => { setOverlay("none"); setSettingsStack([]); }}
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
  else if (overlay === "events")
    content = <EventsScreen destination={eventTarget} onBack={() => {
      setEventTarget(null); setOverlay("none");
    }} />;
  else if (overlay === "edit")
    content = (
      <EditProfile
        alumniId={currentAlumniId}
        account={settings.account}
        socialLinks={socialLinksByAlumni[currentAlumniId]}
        onSaveSocialLinks={saveSocialLinks}
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
    content = <CommunityFeed profile={mainProfile} onProfile={() => setScreen("profile")} focusPostId={feedTarget} onCreationChange={setFeedCreationOpen} />;
  else if (screen === "inbox")
    content = (
      <InboxScreen
        openChat={openChat}
        store={messaging}
        profile={mainProfile}
        onProfile={() => setScreen("profile")}
      />
    );
  else
    content = (
      <ProfileScreen
        account={settings.account}
        locationVisible={privacy.locationVisible}
        setLocationVisible={(locationVisible) =>
          update("privacy", (current) => ({ ...current, locationVisible }))
        }
        openSettings={openSettings}
        edit={() => setOverlay("edit")}
      />
    );
  return (
    <NotificationNavigation.Provider value={{
      open: () => setOverlay("notifications"), unread: notificationUnread,
    }}>
    <div className="app-stage app-stage--signed">
      <div className="phone-shell">
        {content}
        {overlay === "none" && !(screen === "feed" && feedCreationOpen) && <BottomNav screen={screen} setScreen={setScreen} t={t} />}
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
    </NotificationNavigation.Provider>
  );
}
