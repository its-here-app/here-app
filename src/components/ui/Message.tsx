import type { ReactNode } from "react";

interface MessageProps {
  icon?: ReactNode;
  header?: string;
  children?: ReactNode;
  className?: string;
}

export default function Message({ icon, header, children, className = "mt-16" }: MessageProps) {
  return (
    <div className={`text-center flex flex-col items-center ${className}`}>
      {icon && (
        <div className="size-12 rounded-full bg-grey-300 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        {header && <h1 className="text-header-radio-1 mb-2">{header}</h1>}
        {children && (
          <div className="text-body-sm text-secondary mb-6">{children}</div>
        )}
      </div>
    </div>
  );
}
