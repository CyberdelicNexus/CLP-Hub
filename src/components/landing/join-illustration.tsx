import { useId } from "react";

/** Sculpted glass objects with a shared upper-left light and transparent ground. */
export function JoinIllustration({ step }: { step: string }) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className="join-illustration" viewBox="20 8 260 184" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-glass`} x1="65" y1="25" x2="206" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dce5ff" stopOpacity=".94" />
          <stop offset=".28" stopColor="#9b9fde" stopOpacity=".75" />
          <stop offset=".68" stopColor="#55518d" stopOpacity=".8" />
          <stop offset="1" stopColor="#282a4b" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="91" y1="52" x2="224" y2="177" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9eaddc" /><stop offset=".4" stopColor="#625c9a" /><stop offset="1" stopColor="#20233d" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="80" y1="30" x2="213" y2="166" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5f2ff" stopOpacity=".95" /><stop offset=".48" stopColor="#c9bcfa" stopOpacity=".48" /><stop offset="1" stopColor="#a5adf2" stopOpacity=".08" />
        </linearGradient>
        <radialGradient id={`${id}-pearl`} cx=".3" cy=".22" r=".8">
          <stop stopColor="#fcf5ff" /><stop offset=".2" stopColor="#d7c4ff" /><stop offset=".52" stopColor="#9b83d5" /><stop offset=".83" stopColor="#4c467e" /><stop offset="1" stopColor="#24283f" />
        </radialGradient>
        <radialGradient id={`${id}-blue`} cx=".3" cy=".22" r=".8">
          <stop stopColor="#edfaff" /><stop offset=".2" stopColor="#bfd9f9" /><stop offset=".52" stopColor="#7f9fc9" /><stop offset=".83" stopColor="#3e537d" /><stop offset="1" stopColor="#20283e" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor="#a795f0" stopOpacity=".16" /><stop offset="1" stopColor="#8b80c9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-trace`} x1="97" y1="71" x2="204" y2="155" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1e8ff" /><stop offset=".5" stopColor="#ae9ae9" /><stop offset="1" stopColor="#766997" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <ellipse cx="153" cy="106" rx="132" ry="91" fill={paint("halo")} />
      <ellipse cx="153" cy="174" rx="70" ry="8" fill="#030610" opacity=".65" filter={paint("shadow")} />
      {step === "01" ? (
        <>
          {/* A bevelled, gently tilted sheet with an inset writing surface. */}
          <path d="m105 30 92 15q10 2 8 12l-18 103q-2 10-12 8l-92-16q-10-2-8-12L94 39q2-11 11-9Z" fill={paint("edge")} />
          <path d="m99 24 92 15q10 2 8 12l-18 103q-2 10-12 8l-92-16q-10-2-8-12L88 33q2-11 11-9Z" fill={paint("glass")} stroke={paint("rim")} strokeWidth="1.4" />
          <path d="m101 42 78 13-15 86-78-13Z" fill="#202943" fillOpacity=".26" stroke="#e1d9ff" strokeOpacity=".13" />
          <g stroke="#f1edff" strokeLinecap="round" strokeLinejoin="round">
            <path d="m105 66 3 4 6-7m-12 22 3 4 6-7m-12 22 3 4 6-7" strokeWidth="2" />
            <path d="m124 69 36 6m-39 13 36 6m-39 13 25 4" strokeWidth="2.5" opacity=".6" />
          </g>
          <path d="m89 35-17 96q-1 6 5 7" stroke="#e7edff" strokeOpacity=".5" strokeLinecap="round" />
          <circle cx="194" cy="135" r="29" fill={paint("pearl")} />
          <circle cx="194" cy="135" r="28" stroke={paint("rim")} />
          <path d="m182 135 8 8 17-18" stroke="#f7f1ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M178 119a23 23 0 0 1 26-4" stroke="white" strokeOpacity=".4" strokeLinecap="round" />
        </>
      ) : step === "02" ? (
        <>
          {/* Two offset cast-glass speech forms, with visible edge thickness. */}
          <path d="M145 73h65q18 0 18 18v38q0 18-18 18h-5l-2 20-24-20h-34q-18 0-18-18V91q0-18 18-18Z" fill={paint("edge")} />
          <path d="M140 67h65q18 0 18 18v38q0 18-18 18h-5l-2 20-24-20h-34q-18 0-18-18V85q0-18 18-18Z" fill={paint("blue")} stroke={paint("rim")} strokeWidth="1.2" />
          <path d="M80 38h78q20 0 20 20v42q0 20-20 20h-41l-26 20 1-20H80q-20 0-20-20V58q0-20 20-20Z" fill={paint("edge")} />
          <path d="M75 31h78q20 0 20 20v42q0 20-20 20h-41l-26 20 1-20H75q-20 0-20-20V51q0-20 20-20Z" fill={paint("glass")} stroke={paint("rim")} strokeWidth="1.4" />
          <path d="M63 64V52q0-12 12-12h59" stroke="white" strokeOpacity=".4" strokeLinecap="round" />
          <g fill={paint("pearl")} stroke="#e6dcff" strokeOpacity=".5">
            <circle cx="86" cy="73" r="6" /><circle cx="113" cy="73" r="6" /><circle cx="140" cy="73" r="6" />
          </g>
          <path d="M155 124h43" stroke="#e3edff" strokeWidth="2.5" strokeOpacity=".55" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* A shared origin divides into two equally weighted, luminous groups. */}
          <path d="M150 64v16q0 9-12 16l-43 24m55-40q0 9 12 16l43 24" stroke="#222a45" strokeWidth="7" strokeLinecap="round" />
          <path d="M150 61v16q0 9-12 16l-43 24m55-40q0 9 12 16l43 24" stroke={paint("trace")} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="93" cy="150" rx="38" ry="16" fill={paint("edge")} />
          <ellipse cx="93" cy="144" rx="38" ry="16" fill={paint("glass")} stroke={paint("rim")} />
          <ellipse cx="207" cy="150" rx="38" ry="16" fill={paint("edge")} />
          <ellipse cx="207" cy="144" rx="38" ry="16" fill={paint("glass")} stroke={paint("rim")} />
          <circle cx="93" cy="122" r="23" fill={paint("blue")} />
          <circle cx="207" cy="122" r="23" fill={paint("pearl")} />
          <circle cx="150" cy="47" r="23" fill={paint("pearl")} />
          <path d="M137 33a19 19 0 0 1 23-2M80 108a19 19 0 0 1 23-2m91 2a19 19 0 0 1 23-2" stroke="#f3f1ff" strokeOpacity=".5" strokeLinecap="round" />
          <path d="M60 144q6 12 30 13m84-13q6 12 30 13" stroke="#d8d0fb" strokeOpacity=".25" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
