# Messenger Ni Kat

A beginner-friendly React + Vite messaging frontend with a dark burgundy theme and an original interactive 3D character.

## Run

- `npm install`
- `npm run dev`
- `npm run build` for the production build

On Windows PowerShell, use `npm.cmd` if script execution is disabled. Open the local URL printed by Vite. The landing page is `/#welcome`, signup is `/#signup`, and the demo workspace is `/#home`.

## Major files

| File | What it does |
| --- | --- |
| `index.html` | HTML shell, app title, and page metadata. |
| `src/main.jsx` | Mounts React and loads the base stylesheet, followed by the burgundy theme. |
| `src/App.jsx` | Messaging dashboard, contacts, saved messages, navigation, and account/profile dialogs. |
| `src/Welcome.jsx` | Character-focused landing page with signup, login, and demo entry points. |
| `src/Brand.jsx` | Shared Messenger Ni Kat name and icon. |
| `src/AuthPage.jsx` | Signup and login forms, duplicate-number checking, and saving character choices with an account. |
| `src/Character.jsx` | Character picker, hoodie colors, skin tones, glasses, and badges. Loads the 3D renderer only when a character is displayed. |
| `src/Character3D.jsx` | Three.js canvas, cursor tracking, smooth head/eye animation, blinking, idle movement, resizing, and cleanup. Small profile thumbnails are rendered from the same 3D model. |
| `src/characterModel.js` | Builds the original character from real 3D geometry: face, eyes, hair, glasses, hoodie, and jacket. Separates the head and eyes so they can move independently. Also sets up studio lights and the camera. |
| `src/data.js` | Demo contacts/messages, browser storage helpers, number normalization, and demo password digest. |
| `src/style.css` | Base layouts and responsive messaging panels. |
| `src/theme.css` | Burgundy/pink styling, landing page, signup, customizer, and 3D canvas layouts. |
| `vite.config.js` | Vite development configuration. |
| `tests/character-browser.mjs` | Headless Chrome checks for cursor tracking, pause, signup, uniqueness, character persistence, and mobile layout. Run with `node tests/character-browser.mjs` while Vite is running on port 5173. |

## Character behavior

The featured character is live WebGL geometry, not a photograph or a flat image rotated with CSS. Moving the pointer anywhere on the page turns the character's head and shifts its pupils. Movement is smoothed and limited to natural head-turn angles. The character also blinks and breathes gently. Touching the screen directs its gaze on touch devices. The pause button and the system's reduced-motion setting disable movement.

Signup offers three hairstyles/characters, three skin tones, three hoodie colors, optional glasses, and a profile badge. Choices update the real 3D model immediately and are saved with the account. Existing users can open their profile or Settings, choose **Customize my character**, then save. Existing browser accounts remain compatible; the internal `loop-*` storage names are retained to preserve earlier demo data.

Only large character previews animate. Small avatar icons are cached snapshots rendered from the same model, sharing one offscreen renderer to avoid creating many GPU contexts. Large renderers release geometry, materials, listeners, and WebGL contexts when removed. Offscreen/hidden views skip rendering. A text fallback appears when WebGL is unavailable. Hardware acceleration is recommended. Three.js is a separately loaded bundle; Vite may report its size as a non-blocking build warning.

## Try messaging

Select **Take a look around** to explore the demo. Search people by name or number, start a chat, type and send a message, or save a message with its bookmark control. Attachments are filename-only demo messages and do not upload files.

Signup requires full name, email, a password of at least 8 characters, and a unique custom contact number containing only 6-15 digits. Formatting characters are rejected; leading zeros are preserved. Firestore checks numbers/{customNumber} before Auth creation, then a transaction creates the number lookup and users/{uid} profile together. Profiles contain fullName, email, customNumber, a server-created createdAt timestamp, and avatar. Avatar maps the existing state as character: style (0-2), hoodieColor: mood, skinTone: skin (0-2), glasses: boolean, and badge: badge. Implicit skin and glasses selections are resolved using the same defaults as the customizer.

## Firebase signup setup

Enable Email/Password in Firebase Authentication and create the Cloud Firestore database. Publish the included firestore.rules in the Firebase console before using signup. These rules permit exact-number availability checks before authentication, deny collection listing, and only allow an authenticated account to create its own matching profile and lookup. Rules have not been deployed by this change.

Signup uses the supplied email and password with Firebase Email/Password Authentication. No synthetic email identifiers are used. Passwords are handled by Firebase Auth and are not written to Firestore or local account storage. Successful signup sends a Firebase verification email and keeps the session active on the verification screen. The home screen requires emailVerified after reloading the Firebase user. Resend verification email and I have verified my email controls allow the user to finish verification.

Auth creation and Firestore writes are separate operations. If saving fails, keep the signup page open and use Retry signup; it reuses the created Auth account. If another signup claims the chosen number, enter a different number and retry with the same Auth account. Leaving the page after a failed save may leave an Auth-only account requiring support recovery. Login now uses Firebase email/password authentication with the existing form styling. Protected routes wait for Firebase session restoration, reload the user, and require verified email before rendering the workspace. Signed-out visitors must log in, including when opening a direct home link. Registration character choices are saved to Firestore and restored from the profile at login. Authenticated profiles are passed directly from Firestore to the workspace without localStorage fallback. Older profiles without avatar display initials until the user saves a character. Character edits in Settings save the avatar to Firestore (publish the updated avatar-only update rule). Demo messages remain local; friends and real messaging are not implemented.

Validation: production build and mocked signup-flow tests. Live Firebase writes and deployed security rules have not been verified.

The earlier generated concept image is retained in `artifacts/concept-characters.png` for reference only; the app does not use it.
