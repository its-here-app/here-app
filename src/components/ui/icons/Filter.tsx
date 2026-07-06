interface Props {
  focus?: boolean;
  className?: string;
}

export function Filter({ focus = false, className }: Props) {
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
      {focus ? (
        <>
          <path fillRule="evenodd" clipRule="evenodd" d="M5 7.5L19 7.5L19 9L5 9L5 7.5Z" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M7 11.5L17 11.5L17 13L7 13L7 11.5Z" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M9 15L15 15L15 16.5L9 16.5L9 15Z" fill="currentColor" />
        </>
      ) : (
        <>
          <path fillRule="evenodd" clipRule="evenodd" d="M5 7.5L19 7.5L19 8.5L5 8.5L5 7.5Z" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M7 11.5L17 11.5L17 12.5L7 12.5L7 11.5Z" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M9 15.5L15 15.5L15 16.5L9 16.5L9 15.5Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
