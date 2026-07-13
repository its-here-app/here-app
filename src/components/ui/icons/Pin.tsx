interface Props {
  className?: string;
}

export function Pin({ className }: Props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" />
      <path
        d="M7.59961 13.2998C4.88064 9.67402 7.46788 4.5 12 4.5C16.5321 4.5 19.1194 9.67402 16.4004 13.2998L12 19.167L7.59961 13.2998Z"
        stroke="currentColor"
      />
    </svg>
  );
}
