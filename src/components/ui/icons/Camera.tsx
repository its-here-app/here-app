interface Props {
  className?: string;
}

export function Camera({ className }: Props) {
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
      <circle cx="12" cy="13" r="2.5" stroke="currentColor" />
      <path
        d="M10.8271 6.5H13.1729C13.3165 6.5 13.4529 6.56213 13.5479 6.66992L14.5762 7.83691C14.8609 8.16044 15.2711 8.3457 15.7021 8.3457H16.5C17.3283 8.34571 17.9997 9.0175 18 9.8457V16C18 16.8284 17.3284 17.5 16.5 17.5H7.5C6.67157 17.5 6 16.8284 6 16V9.8457C6.00026 9.0175 6.67174 8.34571 7.5 8.3457H8.29785C8.72885 8.3457 9.13906 8.16044 9.42383 7.83691L10.4521 6.66992C10.5471 6.56213 10.6835 6.5 10.8271 6.5Z"
        stroke="currentColor"
        strokeLinejoin="bevel"
      />
    </svg>
  );
}
