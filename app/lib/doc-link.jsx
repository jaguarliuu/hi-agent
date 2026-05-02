import NextLink from 'next/link'

export function DocLink({ href = '', children, ...rest }) {
  const isInternal =
    typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')
  if (isInternal) {
    return (
      <NextLink href={href} {...rest}>
        {children}
      </NextLink>
    )
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}
