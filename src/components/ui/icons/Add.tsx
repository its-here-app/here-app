interface Props {
  focus?: boolean;
  className?: string;
}

export function Add({ focus = false, className }: Props) {
  if (focus) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <mask id="path-1-inside-1_4888_40979" fill="white">
          <path fillRule="evenodd" clipRule="evenodd" d="M20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12ZM11.5 11.5V8H12.5V11.5H16V12.5H12.5V16H11.5V12.5H8L8 11.5H11.5Z" />
        </mask>
        <path fillRule="evenodd" clipRule="evenodd" d="M20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12ZM11.5 11.5V8H12.5V11.5H16V12.5H12.5V16H11.5V12.5H8L8 11.5H11.5Z" fill="currentColor" />
        <path d="M11.5 8V7H10.5V8H11.5ZM11.5 11.5V12.5H12.5V11.5H11.5ZM12.5 8H13.5V7H12.5V8ZM12.5 11.5H11.5V12.5H12.5V11.5ZM16 11.5H17V10.5H16V11.5ZM16 12.5V13.5H17V12.5H16ZM12.5 12.5V11.5H11.5V12.5H12.5ZM12.5 16V17H13.5V16H12.5ZM11.5 16H10.5V17H11.5V16ZM11.5 12.5H12.5V11.5H11.5V12.5ZM8 12.5H7L7 13.5H8V12.5ZM8 11.5V10.5H7L7 11.5L8 11.5ZM12 21C16.9706 21 21 16.9706 21 12H19C19 15.866 15.866 19 12 19V21ZM3 12C3 16.9706 7.02944 21 12 21V19C8.13401 19 5 15.866 5 12H3ZM12 3C7.02944 3 3 7.02944 3 12H5C5 8.13401 8.13401 5 12 5V3ZM21 12C21 7.02944 16.9706 3 12 3V5C15.866 5 19 8.13401 19 12H21ZM10.5 8V11.5H12.5V8H10.5ZM12.5 7H11.5V9H12.5V7ZM13.5 11.5V8H11.5V11.5H13.5ZM12.5 12.5H16V10.5H12.5V12.5ZM15 11.5V12.5H17V11.5H15ZM16 11.5H12.5V13.5H16V11.5ZM13.5 16V12.5H11.5V16H13.5ZM11.5 17H12.5V15H11.5V17ZM10.5 12.5V16H12.5V12.5H10.5ZM11.5 11.5H8V13.5H11.5V11.5ZM9 12.5V11.5L7 11.5L7 12.5H9ZM8 12.5H11.5V10.5H8V12.5Z" fill="currentColor" mask="url(#path-1-inside-1_4888_40979)" />
      </svg>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M11.5 16L11.5 8L12.5 8L12.5 16L11.5 16Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M8 11.5L16 11.5L16 12.5L8 12.5L8 11.5Z" fill="currentColor" />
    </svg>
  );
}
