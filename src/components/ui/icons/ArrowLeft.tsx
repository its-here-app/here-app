interface Props {
  focus?: boolean;
  className?: string;
}

export function ArrowLeft({ focus = false, className }: Props) {
  if (focus) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M5.00691 11.2205L20.0069 11.2205V12.7205L5.00691 12.7205L5.00691 11.2205Z" fill="currentColor" />
        <path fillRule="evenodd" clipRule="evenodd" d="M10.016 5.69971L4.00201 11.9847L5.03904 13.0685L11.053 6.78348L10.016 5.69971Z" fill="currentColor" />
        <path fillRule="evenodd" clipRule="evenodd" d="M10.0199 18.2707L4 11.9795L5.03703 10.8957L11.0569 17.1869L10.0199 18.2707Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.8935 11.4996L19.8935 11.4996V12.4996L4.8935 12.4996L4.8935 11.4996Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M9.65396 6.0874L4.00128 11.9948L4.69264 12.7173L10.3453 6.80992L9.65396 6.0874Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M9.65805 17.9123L4 11.9993L4.69136 11.2768L10.3494 17.1898L9.65805 17.9123Z" fill="currentColor" />
    </svg>
  );
}
