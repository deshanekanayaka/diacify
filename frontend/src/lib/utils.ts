import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Join class names and let later Tailwind utilities win over earlier ones.
 *  Watermelon UI components import this under the name `cn`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
