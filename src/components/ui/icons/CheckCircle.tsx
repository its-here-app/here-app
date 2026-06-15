interface Props {
  focus?: boolean;
  className?: string;
}

export function CheckCircle({ focus = false, className }: Props) {
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
        <path
          d="M12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4ZM10.8457 13.4707L8.70703 11.332L8 12.04L10.8281 14.8682L10.957 14.7393L10.9746 14.7568L15.9248 9.80762L15.2178 9.10059L10.8457 13.4707Z"
          fill="currentColor"
        />
      ) : (
        <>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" />
          <path d="M15.2173 9.09961L15.9244 9.80672L10.9746 14.7565L10.2675 14.0494L15.2173 9.09961Z" fill="currentColor" />
          <path d="M8 12.0391L8.70711 11.332L11.5355 14.1604L10.8284 14.8675L8 12.0391Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
