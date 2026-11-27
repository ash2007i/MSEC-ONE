# MSGI One authentication integration

Backend setup was cancelled. There is no live authentication provider, Google
OAuth configuration, or existing access-code verification endpoint in this repo.
The existing password-reset adapter is unchanged.

Temporary website preview is explicitly enabled by App while `membershipAuth` is
absent. Registration Continue and both Google buttons open the same shared access-code page.
Its Back action restores the originating registration/login form and entered details. Entering any
non-empty code and selecting Verify Me opens sample Home for preview without a
verification-success claim. Email/password Login still opens sample Home directly.
None of these preview actions creates an account, verifies membership, starts
OAuth, or persists an auth session.
This uses a separate `onPreview` callback, never a fabricated verified session.
Supplying a real `membershipAuth` service disables this preview path and restores
the normal guarded authentication flow. The default disconnected-service warning
is hidden only for this explicitly enabled preview.

Configure `AppServices.membershipAuth` at the app entry point using the contract
in `model.ts`. Keep credentials and membership verification server-side. The
contract is not itself a backend or an authorization boundary.

## Server requirements

- Use secure provider sessions (e.g. HttpOnly, Secure cookies), CSRF protection,
  rate limits and real session expiry. `getSession` must validate the current
  session and return its authoritative membership status; return null if signed out.
- `register` must enforce unique normalized email addresses and password policy,
  create an inactive/pending user, and establish a pending registration session.
  Return `pending`, never `verified`.
- Both Google buttons call **the same** `signInGoogle` method. Configure OAuth
  client/redirect URLs and state/PKCE validation with the selected provider.
  Request verified email/profile scopes. Do not implement OAuth token exchange
  in UI code or store provider secrets here.
- Identify Google accounts using their provider subject. Never silently merge
  accounts based on an unverified email. Resolve existing-account conflicts using
  the provider's authenticated account-linking flow; do not create duplicates.
- Google returns a verified session for an existing verified member, otherwise
  a pending session with verified email and available membership details.
- `completeProfile` collects only missing/invalid membership details for the current
  pending user and must still return `pending`. Membership details do not by
  themselves activate an account.
- **Only one** `verifyAccessCode(code, signal)` operation is called by the single
  `AccessCodeVerification` component, regardless of registration method.
  Bind it to the institution's existing code verifier, without inventing formats
  or code lengths. Validate user, code, institution and membership details on the
  server. In one transaction check validity, expiry/revocation, previous use and
  membership uniqueness, claim the code, associate the membership, activate the
  user and persist verification status. Return a verified account only after commit.
- `signIn` authenticates credentials and returns verified or pending status.
  `signOut` must revoke/end the real session.
- Every protected API/resource must independently authorize the current verified
  member. Hiding screens in React cannot secure server data.
- Honour AbortSignal and map provider failures to the safe `AuthFlowError` codes
  in `model.ts`; never expose raw tokens, SQL errors, access codes or passwords.

## UI and routing

New visitors start at Create Profile. Manual and Google registration converge on
the same access-code component; Google only requests missing profile fields first.
Verified users go directly to Home. Pending sessions restore the shared flow after
reload. No localStorage authentication/verification flag is trusted or written.
Success requires a verified backend session. The shared confirmation transitions
to Home or allows immediate navigation via its button.

The app's existing Home/Map/Feed/Inbox/Directory remain prototype content. Wiring
an auth adapter does not turn that content into live user-owned data; production
data must also be scoped to the authenticated user on the backend.
