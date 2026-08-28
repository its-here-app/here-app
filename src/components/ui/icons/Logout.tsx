interface Props {
  className?: string;
}

export function Logout({ className }: Props) {
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
      <path d="M7 18C5.96435 18 5.113 17.2128 5.01074 16.2041L5 16L5 8C5 6.96435 5.78722 6.113 6.7959 6.01074L7 6L12.75 6L12.75 7L7 7C6.44772 7 6 7.44771 6 8L6 16C6 16.5523 6.44771 17 7 17L12.75 17L12.75 18L7 18Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M19 12.5024L9 12.5024L9 11.5024L19 11.5025L19 12.5024Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M16.0078 16.1741L20 12.002L19.3086 11.2795L15.3165 15.4516L16.0078 16.1741Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M16.0052 7.83008L19.9966 12.0013L19.3052 12.7238L15.3139 8.55259L16.0052 7.83008Z" fill="currentColor" />
    </svg>
  );
}
