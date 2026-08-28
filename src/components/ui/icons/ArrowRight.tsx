interface Props {
  focus?: boolean;
  className?: string;
}

export function ArrowRight({ focus = false, className }: Props) {
  if (focus) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M3.9931 11.2205H18.9931V12.7205H3.9931V11.2205Z" fill="currentColor" />
        <path fillRule="evenodd" clipRule="evenodd" d="M13.984 5.69971L19.998 11.9847L18.961 13.0685L12.947 6.78348L13.984 5.69971Z" fill="currentColor" />
        <path fillRule="evenodd" clipRule="evenodd" d="M13.9801 18.2707L20 11.9795L18.963 10.8957L12.9431 17.1869L13.9801 18.2707Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.1065 11.4996H19.1065V12.4996H4.1065V11.4996Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M14.346 6.0874L19.999 11.9948L19.307 12.7173L13.655 6.80992L14.346 6.0874Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M14.342 17.9123L20 11.9993L19.309 11.2768L13.651 17.1898L14.342 17.9123Z" fill="currentColor" />
    </svg>
  );
}
