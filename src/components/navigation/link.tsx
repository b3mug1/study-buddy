import { Link as RouterLink } from "react-router";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof RouterLink>, "to"> & {
  href: ComponentProps<typeof RouterLink>["to"];
};

export default function Link({ href, ...props }: Props) {
  return <RouterLink to={href} {...props} />;
}
