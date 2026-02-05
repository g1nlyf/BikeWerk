import { ReactNode } from 'react';

interface PageTitleProps {
  children: ReactNode;
  className?: string;
}

export function PageTitle({ children, className = '' }: PageTitleProps) {
  return (
    <h1 className={`text-3xl md:text-4xl lg:text-5xl font-bold mb-6 ${className}`}>
      {children}
    </h1>
  );
}
