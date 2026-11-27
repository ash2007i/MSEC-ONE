import { Avatar, Icon, TopBar, VerifyBadge, type IconName } from "../ui/chrome";
import type { Translator } from "../settings/i18n";
import { personalFields, type AccountInfo, type PrivacySettings } from "../settings/model";
import { getSharedSocialLinks, type SocialLinks, type SocialPlatform } from "./socialLinks";

export const socialPlatformIcons: Record<SocialPlatform, IconName> = {
  linkedin: "linkedin",
  instagram: "instagram",
  x: "x",
  facebook: "facebook",
  youtube: "youtube",
  website: "globe",
};

/**
 * `owner`: the signed-in member previewing what verified alumni see.
 * `public`: a signed-out visitor opening a public share link; contact details,
 * location and social links are never part of the limited public profile.
 */
export type PreviewAudience = "owner" | "public";

export function ProfilePreview({
  account,
  privacy,
  socialLinks,
  headline,
  audience,
  t,
  onBack,
  onEditPrivacy,
  onSignIn,
}: {
  account: AccountInfo;
  privacy: PrivacySettings;
  socialLinks?: SocialLinks;
  headline: string;
  audience: PreviewAudience;
  t: Translator;
  onBack: () => void;
  onEditPrivacy?: () => void;
  onSignIn?: () => void;
}) {
  const { fields } = privacy;
  const isPublic = audience === "public";
  if (privacy.profileVisibility === "private" && isPublic)
    return <ProfileUnavailable t={t} onBack={onBack} />;

  const role = fields.designation ? account.role : "";
  const company = fields.workplace ? account.company : "";
  const roleLine =
    role && company ? t("preview.roleAt", { role, company }) : role || company || "";
  const studyLine = [
    fields.department ? account.department : "",
    fields.graduationYear ? t("account.classOf", { year: account.graduationYear }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  // Only the city is ever shown, and only with both the field and location sharing enabled.
  const showLocation = !isPublic && fields.location && privacy.locationVisible;
  const contact = isPublic
    ? []
    : ([
        fields.email && { icon: "mail", label: t("privacy.field.email"), value: account.email },
        fields.phone && { icon: "phone", label: t("privacy.field.phone"), value: account.phone },
      ].filter(Boolean) as { icon: IconName; label: string; value: string }[]);
  const links = !isPublic && fields.socialLinks ? getSharedSocialLinks(socialLinks) : [];
  const hiddenCount =
    personalFields.filter((field) => !fields[field]).length +
    (fields.location && !privacy.locationVisible ? 1 : 0);
  const isPrivate = privacy.profileVisibility === "private";

  return (
    <div className="screen person-profile profile-preview">
      <TopBar
        title={t("preview.title")}
        onBack={onBack}
        backLabel={t("common.back")}
      />
      <div className="person-cover">
        {!isPublic && (
          <div
            className={`profile-preview__banner ${isPrivate ? "is-private" : ""}`}
            role="note"
          >
            <Icon name={isPrivate ? "lock" : "eye"} size={16} />
            <div>
              <b>{t(`preview.banner.${privacy.profileVisibility}`)}</b>
              {!isPrivate && (
                <span>
                  {hiddenCount
                    ? t("preview.hiddenCount", { count: hiddenCount })
                    : t("preview.allVisible")}
                </span>
              )}
            </div>
          </div>
        )}
        <div className={`person-card glass-panel ${isPrivate ? "profile-preview__dimmed" : ""}`}>
          <Avatar
            person={{ name: account.fullName, role: account.role, image: account.avatar }}
            size="xl"
          />
          {account.verified && <VerifyBadge label={t("account.alumni")} />}
          <h1>{account.fullName}</h1>
          {roleLine && <p>{roleLine}</p>}
          {studyLine && <span>{studyLine}</span>}
          {showLocation && account.city && (
            <small>
              <Icon name="pin" size={13} />
              {t("preview.locationApprox", { city: account.city })}
            </small>
          )}
          {isPublic ? (
            <div className="profile-preview__actions">
              <button type="button" className="is-primary" onClick={onSignIn}>
                <Icon name="lock" size={16} />
                {t("preview.public.cta")}
              </button>
            </div>
          ) : (
            onEditPrivacy && (
              <div className="profile-preview__actions">
                <button type="button" onClick={onEditPrivacy}>
                  <Icon name="shield" size={16} />
                  {t("preview.editPrivacy")}
                </button>
              </div>
            )
          )}
        </div>
        {isPublic && <p className="profile-preview__note">{t("preview.public.note")}</p>}
      </div>
      {!isPublic && (
        <div className={`content person-details ${isPrivate ? "profile-preview__dimmed" : ""}`}>
          <section>
            <p className="eyebrow">{t("preview.about")}</p>
            <h2>{headline}</h2>
          </section>
          {contact.length > 0 && (
            <section aria-labelledby="preview-contact-title">
              <p className="eyebrow" id="preview-contact-title">
                {t("preview.contact")}
              </p>
              <div className="social-links profile-preview__contacts">
                {contact.map((item) => (
                  <div className="profile-preview__contact" key={item.label}>
                    <span className="frosted-icon">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <span>
                      <small>{item.label}</small>
                      <b>{item.value}</b>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {links.length > 0 && (
            <section aria-labelledby="preview-social-title">
              <p className="eyebrow" id="preview-social-title">
                {t("preview.social")}
              </p>
              <div className="social-links">
                {links.map((link) => (
                  <a
                    key={link.key}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("preview.openLink", { platform: link.label })}
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
        </div>
      )}
    </div>
  );
}

export function ProfileUnavailable({ t, onBack }: { t: Translator; onBack: () => void }) {
  return (
    <div className="screen person-profile profile-preview">
      <TopBar title={t("preview.title")} onBack={onBack} backLabel={t("common.back")} />
      <div className="content">
        <div className="empty-state glass-panel profile-preview__empty" role="status">
          <div>
            <Icon name="eyeOff" size={22} />
          </div>
          <h3>{t("preview.unavailable.title")}</h3>
          <p>{t("preview.unavailable.body")}</p>
        </div>
      </div>
    </div>
  );
}
