/**
 * Drop-in replacement for next/link. External links and same-page anchors
 * (#hash) become normal <a>. Everything else routes through react-router.
 */
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
  prefetch?: boolean; // accepted and ignored for next/link compatibility
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch, ...rest },
  ref,
) {
  void prefetch;
  const isExternal = /^(https?:|mailto:|tel:)/.test(href);
  const isHash = href.startsWith("#");
  if (isExternal || isHash) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <RouterLink ref={ref} to={href} {...rest}>
      {children}
    </RouterLink>
  );
});

export default Link;
