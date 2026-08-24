const PERSON_TONE_CLASSES = [
  'person-tone-indigo',
  'person-tone-cyan',
  'person-tone-amber',
  'person-tone-rose',
  'person-tone-violet',
  'person-tone-emerald',
  'person-tone-sky',
  'person-tone-orange',
] as const;

export function personToneClass(personId: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < personId.length; index += 1) {
    hash ^= personId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return PERSON_TONE_CLASSES[(hash >>> 16) % PERSON_TONE_CLASSES.length]!;
}
