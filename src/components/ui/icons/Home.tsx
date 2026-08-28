interface Props {
  focus?: boolean;
  className?: string;
}

export function Home({ focus = false, className }: Props) {
  if (focus) {
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
        <path
          d="M11.1084 5.97852C11.5983 5.4798 12.4017 5.4798 12.8916 5.97852L17.3916 10.5605C17.6212 10.7943 17.75 11.1089 17.75 11.4365V18C17.75 18.6904 17.1904 19.25 16.5 19.25H7.5C6.80964 19.25 6.25 18.6904 6.25 18V11.4365C6.25 11.1089 6.37885 10.7943 6.6084 10.5605L11.1084 5.97852Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="bevel"
        />
      </svg>
    );
  }

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
      <path
        d="M10.9297 5.80371C11.5176 5.20508 12.4824 5.20508 13.0703 5.80371L17.5703 10.3857C17.8456 10.6662 18 11.0435 18 11.4365V18C18 18.8284 17.3284 19.5 16.5 19.5H7.5C6.67157 19.5 6 18.8284 6 18V11.4365C6 11.0435 6.15436 10.6662 6.42969 10.3857L10.9297 5.80371Z"
        stroke="currentColor"
        strokeLinejoin="bevel"
      />
    </svg>
  );
}
