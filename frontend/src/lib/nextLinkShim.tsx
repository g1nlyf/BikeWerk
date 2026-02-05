import * as React from 'react'

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
}

const Link: React.FC<LinkProps> = ({ href, children, ...props }) => {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

export default Link