import { useEffect, useRef, type InputHTMLAttributes } from "react";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean };

/** A checkbox that can also show "some selected" (which has no HTML attribute). */
export function Checkbox({ indeterminate = false, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="h-4 w-4 accent-primary" {...props} />;
}
