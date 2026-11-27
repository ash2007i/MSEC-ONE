# Messaging prototype

This feature is isolated to Inbox and individual conversations. Its CSS uses only
`msg-` selectors and existing application tokens. Shared branding, navigation,
typography and non-messaging screens are not restyled.

## Boundaries

- `model.ts` is an observable **in-memory, session-only** store. There is no API,
  authentication, durable storage, cross-user delivery or real read tracking.
- Sending/receipt transitions are illustrative. Browser-offline sends expose
  failure and retry states.
- Replies, reactions, forwarding, permissions, edits, pins, deletion and unread
  counts operate against that store and survive navigation until page reload.
- Uploads and microphone-permitted voice recordings use local blob URLs. Nothing
  is uploaded. Leaving the app releases local resources.
- Calls, Meet and GIF search explicitly explain that no service is connected.
- The complete native Unicode 15 emoji dataset is lazy-loaded from
  `@emoji-mart/data`, with all eight categories, search, recents and skin tones.
- No unsupported Ask AI action is exposed.

## Verification

Run the store regression tests with the project's Node 22 toolchain:

```sh
node --experimental-strip-types --test tests/messaging.test.mjs
```

The existing `pnpm build`, `pnpm format --check src/App.tsx src/messaging tests/messaging.test.mjs`
and `pnpm exec tsc --noEmit` checks also apply.
