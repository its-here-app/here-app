interface Props {
  className?: string;
}

export function Reorder({ className }: Props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M5 10L19 10L19 11L5 11L5 10Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M5 7L19 7L19 8L5 8L5 7Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M5 13L19 13L19 14L5 14L5 13Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M5 16L19 16L19 17L5 17L5 16Z" fill="currentColor" />
    </svg>
  );
}
