export const HIGHLIGHT_PLACEHOLDERS = [
  "Add your go-to order...",
  "Add details only regulars know...",
  "Add what you'd tell a friend...",
  "Add the reason you keep coming back...",
];

export function pickHighlightPlaceholder(): string {
  return HIGHLIGHT_PLACEHOLDERS[
    Math.floor(Math.random() * HIGHLIGHT_PLACEHOLDERS.length)
  ];
}
