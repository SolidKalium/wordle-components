/**
 * ProjectMark — self-selecting logo component.
 *
 *   import { ProjectMark } from './ProjectMark.jsx';
 *   <ProjectMark size={48} />                       // auto-picks detail for the size
 *   <ProjectMark level="full" ink="#3b5050" />      // force a level / recolor
 *   <ProjectMark style={{ width: '100%' }} />       // fluid; ResizeObserver picks level
 *
 * Props:
 *   size    number | string   explicit px (number) or any CSS length. Omit to fill container.
 *   level   'auto'|'full'|'mid'|'min'   default 'auto' (chooses by rendered width)
 *   ink     dark tiles / bars / C-plate   default '#3b5050' (try 'currentColor')
 *   accent  light tiles / chart fill      default '#a9bdb8'
 *   paper   tile backgrounds / the C      default '#ffffff'
 *   title   accessible label. Any other props pass to the wrapping <span>.
 *
 * Auto thresholds (rendered CSS px):  > 64 → full,  33–64 → mid,  ≤ 32 → min.
 */
import React from 'react';

const LEVELS = {
  full: ({ ink, accent, paper }) => `<title>Wordle Components — full mark</title>

  <rect x="32" y="32" width="210" height="210" rx="12" fill="${paper}" stroke="${accent}" stroke-width="8"></rect>
  <rect x="63.6727" y="162.7636" width="10.9" height="45.5818" rx="1.2196" fill="${ink}"></rect>
  <rect x="80.5182" y="125.1091" width="10.9" height="83.2364" rx="1.2196" fill="${ink}"></rect>
  <rect x="97.3636" y="99.3455" width="10.9" height="109" rx="1.2196" fill="${ink}"></rect>
  <rect x="114.2091" y="87.4545" width="10.9" height="120.8909" rx="1.2196" fill="${ink}"></rect>
  <rect x="131.0545" y="105.2909" width="10.9" height="103.0545" rx="1.2196" fill="${ink}"></rect>
  <rect x="147.9" y="127.0909" width="10.9" height="81.2545" rx="1.2196" fill="${ink}"></rect>
  <rect x="164.7455" y="154.8364" width="10.9" height="53.5091" rx="1.2196" fill="${accent}"></rect>
  <rect x="181.5909" y="176.6364" width="10.9" height="31.7091" rx="1.2196" fill="${accent}"></rect>
  <rect x="198.4364" y="191.5" width="10.9" height="16.8455" rx="1.2196" fill="${accent}"></rect>

  <rect x="266" y="28" width="218" height="218" rx="16" fill="${accent}"></rect>

  <rect x="28" y="266" width="218" height="218" rx="16" fill="${ink}"></rect>
  <path d="m 536.84774,253.3202 c -9.08919,-88.49989 -67.92967,-140.64307 -173.17279,-140.64307 c -96.15393,0 -171.73759,69.36478 -171.73759,180.82682 0,111.94041 68.88638,181.78356 182.74031,181.78356 90.89179,0 154.51605,-53.5783 164.56197,-142.5566 H 430.64787 c -4.3054,33.00808 -21.52704,58.36211 -57.88373,58.36211 -57.40533,0 -67.92961,-45.4459 -67.92961,-93.76204 0,-66.49452 23.91888,-100.45933 63.62421,-100.45933 35.39996,0 57.88373,20.57022 61.23236,56.44855 z" fill="${paper}" transform="translate(30.13 291.66) scale(0.2923)"></path>

  <rect x="270" y="270" width="210" height="210" rx="12" fill="${paper}" stroke="${accent}" stroke-width="8"></rect>
  <rect x="290.6953" y="290.6953" width="78.3438" height="78.3438" rx="5.1094" fill="${paper}" stroke="${accent}" stroke-width="3.4063"></rect>
  <clipPath id="wc-full-clip"><rect x="292.3984" y="292.3984" width="74.9375" height="74.9375" rx="3.4063"></rect></clipPath>
  <path d="M292.40,338.16 L293.96,339.49 L295.52,340.65 L297.08,341.62 L298.64,342.38 L300.20,342.93 L301.77,343.26 L303.33,343.36 L304.89,343.23 L306.45,342.87 L308.01,342.29 L309.57,341.50 L311.13,340.51 L312.69,339.32 L314.26,337.97 L315.82,336.46 L317.38,334.81 L318.94,333.06 L320.50,331.22 L322.06,329.32 L323.62,327.39 L325.18,325.45 L326.74,323.53 L328.31,321.65 L329.87,319.85 L331.43,318.15 L332.99,316.56 L334.55,315.12 L336.11,313.84 L337.67,312.75 L339.23,311.84 L340.80,311.15 L342.36,310.68 L343.92,310.42 L345.48,310.40 L347.04,310.61 L348.60,311.04 L350.16,311.69 L351.72,312.55 L353.29,313.61 L354.85,314.85 L356.41,316.26 L357.97,317.82 L359.53,319.50 L361.09,321.29 L362.65,323.15 L364.21,325.06 L365.77,327.00 L367.34,328.94 L367.34,367.34 L292.40,367.34 Z" fill="${accent}" clip-path="url(#wc-full-clip)"></path>
  <rect x="288.9922" y="379.2578" width="81.75" height="81.75" rx="6.8125" fill="${ink}"></rect>
  <rect x="379.2578" y="288.9922" width="81.75" height="81.75" rx="6.8125" fill="${accent}"></rect>
  <rect x="380.9609" y="380.9609" width="78.3438" height="78.3438" rx="5.1094" fill="${paper}" stroke="${accent}" stroke-width="3.4063"></rect>`,
  mid:  ({ ink, accent, paper }) => `<title>Wordle Components — mid mark (≈48px)</title>

  <rect x="32" y="32" width="210" height="210" rx="12" fill="${paper}" stroke="${accent}" stroke-width="8"></rect>
  <rect x="63.6727" y="162.7636" width="10.9" height="45.5818" rx="1.2196" fill="${ink}"></rect>
  <rect x="80.5182" y="125.1091" width="10.9" height="83.2364" rx="1.2196" fill="${ink}"></rect>
  <rect x="97.3636" y="99.3455" width="10.9" height="109" rx="1.2196" fill="${ink}"></rect>
  <rect x="114.2091" y="87.4545" width="10.9" height="120.8909" rx="1.2196" fill="${ink}"></rect>
  <rect x="131.0545" y="105.2909" width="10.9" height="103.0545" rx="1.2196" fill="${ink}"></rect>
  <rect x="147.9" y="127.0909" width="10.9" height="81.2545" rx="1.2196" fill="${ink}"></rect>
  <rect x="164.7455" y="154.8364" width="10.9" height="53.5091" rx="1.2196" fill="${ink}"></rect>
  <rect x="181.5909" y="176.6364" width="10.9" height="31.7091" rx="1.2196" fill="${ink}"></rect>
  <rect x="198.4364" y="191.5" width="10.9" height="16.8455" rx="1.2196" fill="${ink}"></rect>

  <rect x="266" y="28" width="218" height="218" rx="16" fill="${accent}"></rect>

  <rect x="28" y="266" width="218" height="218" rx="16" fill="${ink}"></rect>
  <path d="m 536.84774,253.3202 c -9.08919,-88.49989 -67.92967,-140.64307 -173.17279,-140.64307 c -96.15393,0 -171.73759,69.36478 -171.73759,180.82682 0,111.94041 68.88638,181.78356 182.74031,181.78356 90.89179,0 154.51605,-53.5783 164.56197,-142.5566 H 430.64787 c -4.3054,33.00808 -21.52704,58.36211 -57.88373,58.36211 -57.40533,0 -67.92961,-45.4459 -67.92961,-93.76204 0,-66.49452 23.91888,-100.45933 63.62421,-100.45933 35.39996,0 57.88373,20.57022 61.23236,56.44855 z" fill="${paper}" transform="translate(30.13 291.66) scale(0.2923)"></path>

  <rect x="270" y="270" width="210" height="210" rx="12" fill="${paper}" stroke="${accent}" stroke-width="8"></rect>
  <clipPath id="wc-mid-clip"><rect x="288.9922" y="288.9922" width="81.75" height="81.75" rx="6.8125"></rect></clipPath>
  <path d="M292.3985,367.336 L292.3985,341.858 L367.336,305.887 L367.336,367.336 Z" fill="${accent}" clip-path="url(#wc-mid-clip)"></path>
  <rect x="288.9922" y="379.2578" width="81.75" height="81.75" rx="6.8125" fill="${ink}"></rect>
  <rect x="379.2578" y="288.9922" width="81.75" height="81.75" rx="6.8125" fill="${accent}"></rect>`,
  min:  ({ ink, accent, paper }) => `<title>Wordle Components — minimal mark (≤32px)</title>

  <rect x="28" y="28" width="218" height="218" rx="16" fill="${paper}"></rect>
  <rect x="63.6727" y="162.7636" width="10.9" height="45.5818" rx="1.2196" fill="${ink}"></rect>
  <rect x="80.5182" y="125.1091" width="10.9" height="83.2364" rx="1.2196" fill="${ink}"></rect>
  <rect x="97.3636" y="99.3455" width="10.9" height="109" rx="1.2196" fill="${ink}"></rect>
  <rect x="114.2091" y="87.4545" width="10.9" height="120.8909" rx="1.2196" fill="${ink}"></rect>
  <rect x="131.0545" y="105.2909" width="10.9" height="103.0545" rx="1.2196" fill="${ink}"></rect>
  <rect x="147.9" y="127.0909" width="10.9" height="81.2545" rx="1.2196" fill="${ink}"></rect>
  <rect x="164.7455" y="154.8364" width="10.9" height="53.5091" rx="1.2196" fill="${ink}"></rect>
  <rect x="181.5909" y="176.6364" width="10.9" height="31.7091" rx="1.2196" fill="${ink}"></rect>
  <rect x="198.4364" y="191.5" width="10.9" height="16.8455" rx="1.2196" fill="${ink}"></rect>

  <rect x="266" y="28" width="218" height="218" rx="16" fill="${accent}"></rect>

  <rect x="28" y="266" width="218" height="218" rx="16" fill="${ink}"></rect>
  <path d="m 536.84774,253.3202 c -9.08919,-88.49989 -67.92967,-140.64307 -173.17279,-140.64307 c -96.15393,0 -171.73759,69.36478 -171.73759,180.82682 0,111.94041 68.88638,181.78356 182.74031,181.78356 90.89179,0 154.51605,-53.5783 164.56197,-142.5566 H 430.64787 c -4.3054,33.00808 -21.52704,58.36211 -57.88373,58.36211 -57.40533,0 -67.92961,-45.4459 -67.92961,-93.76204 0,-66.49452 23.91888,-100.45933 63.62421,-100.45933 35.39996,0 57.88373,20.57022 61.23236,56.44855 z" fill="${paper}" transform="translate(30.13 291.66) scale(0.2923)"></path>

  <rect x="266" y="266" width="218" height="218" rx="16" fill="${paper}"></rect>
  <clipPath id="wc-min-clip"><rect x="288.9922" y="288.9922" width="172.0156" height="81.75" rx="6.8125"></rect></clipPath>
  <path d="M292.3985,367.336 L292.3985,344.855 L394.825,292.3985 L457.6016,292.3985 L457.6016,367.336 Z" fill="${accent}" clip-path="url(#wc-min-clip)"></path>
  <rect x="288.9922" y="379.2578" width="81.75" height="81.75" rx="6.8125" fill="${ink}"></rect>`,
};

function pickLevel(px) {
  if (px > 64) return 'full';
  if (px > 32) return 'mid';
  return 'min';
}

export function ProjectMark(props) {
  const {
    size, level = 'auto',
    ink = '#3b5050', accent = '#a9bdb8', paper = '#ffffff',
    title = 'Wordle Components', style, className, ...rest
  } = props;

  const ref = React.useRef(null);
  const [auto, setAuto] = React.useState('full');

  React.useEffect(() => {
    if (level !== 'auto' || !ref.current || typeof ResizeObserver === 'undefined') return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w) setAuto(pickLevel(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [level]);

  const chosen = level === 'auto' ? auto : level;
  const inner = LEVELS[chosen]({ ink, accent, paper });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + title + '">' + inner + '</svg>';

  const dim = size == null ? undefined : (typeof size === 'number' ? size + 'px' : size);
  const wrapStyle = Object.assign(
    { display: 'inline-block', lineHeight: 0, width: dim, height: dim, aspectRatio: '1 / 1' },
    style
  );

  return React.createElement('span', {
    ref, className, style: wrapStyle,
    dangerouslySetInnerHTML: { __html: svg }, ...rest,
  });
}
