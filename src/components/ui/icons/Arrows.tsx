interface Props {
  className?: string;
}

export function Arrows({ className }: Props) {
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8.87207 7.5L8.87207 17.5L7.87207 17.5L7.87207 7.5L8.87207 7.5Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12.6748 10.6482L8.3397 6.50005L7.61719 7.19141L11.9523 11.3395L12.6748 10.6482Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4.00002 10.6482L8.3351 6.50005L9.05762 7.19141L4.72253 11.3395L4.00002 10.6482Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M15.0527 16.5L15.0527 6.5L16.0527 6.5L16.0527 16.5L15.0527 16.5Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M11.25 13.3499L15.5851 17.498L16.3076 16.8066L11.9725 12.6585L11.25 13.3499Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M19.9248 13.3518L15.5897 17.5L14.8672 16.8086L19.2023 12.6605L19.9248 13.3518Z" fill="currentColor" />
    </svg>
  );
}
