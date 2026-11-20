/** Long-form support and policy copy. Shown in English; summaries are prototype placeholders. */

export type HelpCategory = "account" | "profile" | "directory" | "messaging" | "events";

export const helpArticles: { id: string; category: HelpCategory; question: string; answer: string }[] =
  [
    {
      id: "verify",
      category: "account",
      question: "How is my alumni status verified?",
      answer:
        "MSGI confirms your registration number, department and graduation year against institutional records. Verified members show a gold Verified alumni badge.",
    },
    {
      id: "signin",
      category: "account",
      question: "I can’t sign in. What should I do?",
      answer:
        "Check that you’re using your registered email or registration number, then use Forgot password on the sign-in screen. If you still can’t sign in, report a login problem from Help & support.",
    },
    {
      id: "edit-profile",
      category: "profile",
      question: "How do I update my headline, company or social links?",
      answer:
        "Open Profile, then Edit profile. Changes to your headline, company, location, about text and social links appear on your alumni profile after you save.",
    },
    {
      id: "profile-visibility",
      category: "profile",
      question: "Who can see my profile?",
      answer:
        "By default, only verified MSGI alumni. You can make your profile private or hide individual details such as your phone number in Settings › Privacy & visibility.",
    },
    {
      id: "directory-search",
      category: "directory",
      question: "How do I find alumni from my batch?",
      answer:
        "Open Directory and search by name, company, city or department. Use the filter button to narrow results by graduation year or location.",
    },
    {
      id: "map",
      category: "directory",
      question: "Why don’t I appear on the alumni map?",
      answer:
        "The map only shows alumni who share their location. Turn on Show my location to alumni in Privacy & visibility. Only your city and an approximate distance are shown.",
    },
    {
      id: "message-requests",
      category: "messaging",
      question: "Who can message me?",
      answer:
        "You decide in Privacy & visibility › Messaging. You can limit message requests and direct contact to connections, or turn requests off entirely.",
    },
    {
      id: "block",
      category: "messaging",
      question: "How do I stop someone from contacting me?",
      answer:
        "Report the person from Help & support and choose Also block this person. You can review and unblock people in Privacy & visibility › Blocked users.",
    },
    {
      id: "rsvp",
      category: "events",
      question: "How do I RSVP to an alumni event?",
      answer:
        "Tap RSVP on an event card from Home or Events & opportunities. You’ll receive reminders if Event reminders is on in Notifications.",
    },
    {
      id: "referrals",
      category: "events",
      question: "How do alumni referrals work?",
      answer:
        "Roles marked Referral are posted by verified alumni. Apply with referral to share your profile with the alumnus who posted the role.",
    },
  ];

export const guidelineSections = [
  {
    title: "Be professional",
    body: "Represent yourself honestly. Use your real name, accurate qualifications and current role. Keep conversations relevant to careers, learning and the MSGI community.",
  },
  {
    title: "Communicate respectfully",
    body: "Treat every member with courtesy, whatever their batch, department or seniority. Harassment, discrimination, hate speech and intimidation are not tolerated.",
  },
  {
    title: "Respect privacy",
    body: "Don’t share another member’s contact details, messages or location without their permission. Use the directory to connect, not to collect data.",
  },
  {
    title: "Use opportunities responsibly",
    body: "Post only genuine roles and events. Referral requests should be specific and considerate. Unsolicited promotion, spam and recruitment scams are removed.",
  },
  {
    title: "Keep content appropriate",
    body: "Share content suitable for a professional, multi-generational community. Don’t post explicit, violent or misleading material.",
  },
  {
    title: "Report concerns",
    body: "If something feels wrong, report it from Help & support. Reports are confidential, and repeated or serious violations may lead to suspension.",
  },
];

export const policySections = [
  {
    id: "terms",
    title: "Terms and conditions",
    updated: "2025-03-01",
    body: [
      "MSGI One is available to verified alumni, students and staff of Meenakshi Sundararajan Group of Institutions.",
      "You are responsible for the accuracy of your profile and for activity on your account.",
      "Content and conduct must follow the Community guidelines. MSGI may suspend accounts that break them.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy policy",
    updated: "2025-03-01",
    body: [
      "We collect the profile, contact and academic details you provide, plus basic usage information needed to run the service.",
      "Your information is shared with other members only as allowed by your Privacy & visibility settings.",
      "Precise location is never collected or shared. Only your city and an approximate distance are shown when you choose.",
    ],
  },
  {
    id: "data",
    title: "Data usage",
    updated: "2025-03-01",
    body: [
      "Community preferences are used to personalize recommendations and opportunities, and stay private unless you choose to share them.",
      "Cached images and downloads are stored on your device and can be cleared at any time from Data & storage.",
      "MSGI does not sell member data.",
    ],
  },
  {
    id: "deletion",
    title: "Account and data deletion",
    updated: "2025-03-01",
    body: [
      "You can deactivate your account to hide your profile temporarily, or delete it permanently from Account information.",
      "Deletion removes your profile, connections and messages. Some records may be retained where required by law or institutional policy.",
    ],
  },
] as const;

export const acknowledgements = [
  "Photography from Unsplash contributors",
  "Built with React and Vite",
  "Emoji data from Emoji Mart",
  "QR codes generated with qrcode-generator by Kazuhiko Arase (MIT)",
];
