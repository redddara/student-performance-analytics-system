import { SVGProps } from "react";

const createIcon = (path: string) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };

export const CalendarCheck = createIcon(
  "M8.25 3v3.5M15.75 3v3.5M5.25 9.5h13.5M6 5.5h12c.97 0 1.75.78 1.75 1.75v11c0 .97-.78 1.75-1.75 1.75H6c-.97 0-1.75-.78-1.75-1.75v-11C4.25 6.28 5.03 5.5 6 5.5Zm8.5 7.25-3.5 3.5-1.75-1.75"
);

export const CheckmarkCircle02 = createIcon(
  "M12 21.25c5.11 0 9.25-4.14 9.25-9.25S17.11 2.75 12 2.75 2.75 6.89 2.75 12 6.89 21.25 12 21.25Zm3.5-9.84-3.5 3.5-1.5-1.5"
);

export const HeartCheck = createIcon(
  "M12 21.25s-6.88-4.04-9.19-7.69c-1.58-2.51-1.2-5.87.94-7.92 2.17-2.08 5.69-1.97 7.81.27L12 6.14l.44-.45c2.12-2.24 5.64-2.35 7.81-.27 2.14 2.05 2.52 5.41.94 7.92-.32.5-.68.99-1.07 1.46M14.25 17l1.75 1.75 3.5-3.5"
);

export const Wellness = createIcon(
  "M12 3.75c-3.97 0-7.21 3-7.21 6.7 0 3.22 2.27 6.24 5.83 8.46l1.38.86 1.38-.86c3.56-2.22 5.83-5.24 5.83-8.46 0-3.7-3.24-6.7-7.21-6.7Zm0 0c.5-1.33 1.56-2.35 2.79-2.35M12 3.75c-.5-1.33-1.56-2.35-2.79-2.35"
);

export const CheckList = createIcon(
  "M15.25 4.75h4M15.25 10.75h4M15.25 16.75h4M4.75 5.5l2 2 3.5-3.5M4.75 11.5l2 2 3.5-3.5M4.75 17.5l2 2 3.5-3.5"
);
