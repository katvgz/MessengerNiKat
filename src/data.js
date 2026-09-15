export const demoUser = { id: 'me', name: 'Alex Morgan', number: '100200300', color: '#4d2334', character: { style: 0, mood: 'rose', badge: 'sparkle' } };
export const people = [
  { id: 'emma', name: 'Emma Wilson', number: '2025550101', photo: '47', online: true, preview: 'That sounds perfect! See you there 😊', time: '10:42 AM', unread: 2, pinned: true },
  { id: 'james', name: 'James Miller', number: '2025550102', photo: '12', online: true, preview: 'You: Just sent you the files', time: '9:38 AM', pinned: true },
  { id: 'sophia', name: 'Sophia Chen', number: '2025550103', photo: '44', online: true, preview: 'Thanks for the recommendation!', time: '9:15 AM', unread: 1 },
  { id: 'oliver', name: 'Oliver Davis', number: '2025550104', photo: '13', preview: 'Are we still on for this weekend?', time: 'Yesterday' },
  { id: 'ava', name: 'Ava Thompson', number: '2025550105', photo: '49', preview: 'You: Haha, absolutely 😂', time: 'Yesterday' },
  { id: 'noah', name: 'Noah Williams', number: '2025550106', photo: '33', preview: 'Let me know what you think.', time: 'Yesterday' },
  { id: 'mia', name: 'Mia Anderson', number: '2025550107', photo: '45', preview: 'See you soon!', time: 'Monday' },
  { id: 'ethan', name: 'Ethan Brooks', number: '2025550108', photo: '53', preview: 'Sounds like a plan 👍', time: 'Monday' },
];
export const initialMessages = [
  { id: 1, text: 'Hey Alex! How’s your morning going?', time: '10:30 AM' },
  { id: 2, text: 'Hey Emma! Pretty good, just wrapping up a few things. How about you?', mine: true, time: '10:32 AM' },
  { id: 3, text: 'Same here! A little coffee is doing most of the work ☕', time: '10:33 AM' },
  { id: 4, text: 'I was thinking, want to check out that new café on Maple Street this afternoon?', time: '10:34 AM' },
  { id: 5, text: 'The one with the little outdoor garden? I’ve been wanting to go!', mine: true, time: '10:36 AM' },
  { id: 6, text: 'Yes, that’s the one! 🌿', time: '10:38 AM' },
  { id: 7, text: 'How does 3 pm sound?', time: '10:38 AM' },
  { id: 8, text: '3 pm works for me. Let’s meet out front!', mine: true, time: '10:40 AM' },
  { id: 9, text: 'That sounds perfect! See you there 😊', time: '10:42 AM' },
];
// Small storage helpers keep browser-only persistence separate from the UI.
export function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function saveStore(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
export function normalizeNumber(value) { return value.replace(/[\s()+-]/g, ''); }
export async function passwordHash(password) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
