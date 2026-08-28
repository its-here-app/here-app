interface Props {
  className?: string;
}

export function Enter({ className }: Props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M7.75 15.1592H6.75L6.75 5.15918L7.75 5.15918L7.75 15.1592Z" fill="currentColor" />
      <path d="M13.2148 11.624C13.4101 11.4288 13.7266 11.4288 13.9219 11.624L17.1035 14.8057C17.2988 15.0009 17.2988 15.3174 17.1035 15.5127L13.9219 18.6943C13.7266 18.8896 13.4101 18.8896 13.2148 18.6943C13.0196 18.4991 13.0196 18.1826 13.2148 17.9873L15.543 15.6592H6.75V14.6592H15.543L13.2148 12.3311C13.0196 12.1358 13.0196 11.8193 13.2148 11.624Z" fill="currentColor" />
    </svg>
  );
}
