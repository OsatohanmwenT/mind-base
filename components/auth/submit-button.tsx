"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
